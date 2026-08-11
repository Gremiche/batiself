import { useEffect, useState } from "react";
import {
  api, Materiau,
  Dependance, DependancePayload,
  Incompatibilite, IncompatibilitePayload,
} from "../api/client";

const EMPTY_DEP: DependancePayload = {
  materiau_principal_id: 0,
  materiau_dependant_id: 0,
  ratio: 1,
  type_dependance: "obligatoire",
  condition: null,
};

const EMPTY_INC: IncompatibilitePayload = {
  materiau_a_id: 0,
  materiau_b_id: 0,
  raison: "",
  severite: "avertissement",
};

export default function Regles() {
  const [materiaux, setMateriaux] = useState<Materiau[]>([]);
  const [dependances, setDependances] = useState<Dependance[]>([]);
  const [incompatibilites, setIncompatibilites] = useState<Incompatibilite[]>([]);
  const [tab, setTab] = useState<"dep" | "inc">("dep");

  const [depForm, setDepForm] = useState<DependancePayload>(EMPTY_DEP);
  const [incForm, setIncForm] = useState<IncompatibilitePayload>(EMPTY_INC);
  const [showDep, setShowDep] = useState(false);
  const [showInc, setShowInc] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [mats, deps, incs] = await Promise.all([
      api.getMateriaux(),
      api.getDependances(),
      api.getIncompatibilites(),
    ]);
    setMateriaux(mats);
    setDependances(deps);
    setIncompatibilites(incs);
  };

  useEffect(() => { load(); }, []);

  const matName = (id: number) => materiaux.find((m) => m.id === id)?.nom ?? `#${id}`;

  const saveDep = async () => {
    if (!depForm.materiau_principal_id || !depForm.materiau_dependant_id) {
      setError("Sélectionnez les deux matériaux."); return;
    }
    try {
      await api.createDependance(depForm);
      await load();
      setShowDep(false); setDepForm(EMPTY_DEP); setError("");
    } catch (e: any) { setError(e.message); }
  };

  const saveInc = async () => {
    if (!incForm.materiau_a_id || !incForm.materiau_b_id) {
      setError("Sélectionnez les deux matériaux."); return;
    }
    if (!incForm.raison.trim()) { setError("La raison est obligatoire."); return; }
    try {
      await api.createIncompatibilite(incForm);
      await load();
      setShowInc(false); setIncForm(EMPTY_INC); setError("");
    } catch (e: any) { setError(e.message); }
  };

  const MatSelect = ({
    value, onChange,
  }: { value: number; onChange: (id: number) => void }) => (
    <select
      className="input"
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value="">-- Sélectionner --</option>
      {materiaux.map((m) => (
        <option key={m.id} value={m.id}>[{m.corps_metier}] {m.nom}</option>
      ))}
    </select>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-bleu mb-2">Règles matériaux</h1>
      <p className="text-gray-500 text-sm mb-6">Dépendances et incompatibilités entre matériaux du référentiel.</p>

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("dep")}
          className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
            tab === "dep" ? "bg-bleu text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Dépendances ({dependances.length})
        </button>
        <button
          onClick={() => setTab("inc")}
          className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
            tab === "inc" ? "bg-bleu text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Incompatibilités ({incompatibilites.length})
        </button>
      </div>

      {tab === "dep" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setShowDep(true); setError(""); }} className="btn-primary">
              + Nouvelle dépendance
            </button>
          </div>
          {dependances.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p>Aucune dépendance définie.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bleu text-white text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Matériau principal</th>
                    <th className="text-left px-4 py-3">Dépendant</th>
                    <th className="text-right px-4 py-3">Ratio</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {dependances.map((d, i) => (
                    <tr key={d.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2.5 font-medium">{matName(d.materiau_principal_id)}</td>
                      <td className="px-4 py-2.5 text-gray-600">└ {matName(d.materiau_dependant_id)}</td>
                      <td className="px-4 py-2.5 text-right">{d.ratio}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="bg-bleu/10 text-bleu px-2 py-0.5 rounded-full">{d.type_dependance}</span>
                        {d.condition && <span className="ml-1 text-gray-400">si: {d.condition}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => api.deleteDependance(d.id).then(load)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "inc" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { setShowInc(true); setError(""); }} className="btn-primary">
              + Nouvelle incompatibilité
            </button>
          </div>
          {incompatibilites.length === 0 ? (
            <div className="card text-center py-10 text-gray-400">
              <p>Aucune incompatibilité définie.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bleu text-white text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Matériau A</th>
                    <th className="text-left px-4 py-3">Matériau B</th>
                    <th className="text-left px-4 py-3">Raison</th>
                    <th className="text-left px-4 py-3">Sévérité</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {incompatibilites.map((inc, i) => (
                    <tr key={inc.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-4 py-2.5 font-medium">{matName(inc.materiau_a_id)}</td>
                      <td className="px-4 py-2.5">{matName(inc.materiau_b_id)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{inc.raison}</td>
                      <td className="px-4 py-2.5">
                        <span className={inc.severite === "bloquant" ? "badge-bloquant" : "badge-avertissement"}>
                          {inc.severite}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => api.deleteIncompatibilite(inc.id).then(load)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal dépendance */}
      {showDep && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-bleu mb-5">Nouvelle dépendance</h2>
            <label className="label">Matériau principal</label>
            <div className="mb-3">
              <MatSelect value={depForm.materiau_principal_id}
                onChange={(id) => setDepForm({ ...depForm, materiau_principal_id: id })} />
            </div>
            <label className="label">Matériau dépendant</label>
            <div className="mb-3">
              <MatSelect value={depForm.materiau_dependant_id}
                onChange={(id) => setDepForm({ ...depForm, materiau_dependant_id: id })} />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Ratio (par unité de ref.)</label>
                <input className="input" type="number" step="0.001" min="0"
                  value={depForm.ratio}
                  onChange={(e) => setDepForm({ ...depForm, ratio: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={depForm.type_dependance}
                  onChange={(e) => setDepForm({ ...depForm, type_dependance: e.target.value })}>
                  <option value="obligatoire">Obligatoire</option>
                  <option value="optionnelle">Optionnelle</option>
                  <option value="conditionnelle">Conditionnelle</option>
                </select>
              </div>
            </div>
            <label className="label">Condition (optionnel)</label>
            <input className="input mb-4" value={depForm.condition ?? ""}
              onChange={(e) => setDepForm({ ...depForm, condition: e.target.value || null })}
              placeholder="si support = béton..." />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDep(false); setError(""); }} className="btn-ghost">Annuler</button>
              <button onClick={saveDep} className="btn-primary">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal incompatibilité */}
      {showInc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-bleu mb-5">Nouvelle incompatibilité</h2>
            <label className="label">Matériau A</label>
            <div className="mb-3">
              <MatSelect value={incForm.materiau_a_id}
                onChange={(id) => setIncForm({ ...incForm, materiau_a_id: id })} />
            </div>
            <label className="label">Matériau B</label>
            <div className="mb-3">
              <MatSelect value={incForm.materiau_b_id}
                onChange={(id) => setIncForm({ ...incForm, materiau_b_id: id })} />
            </div>
            <label className="label">Raison *</label>
            <input className="input mb-3" value={incForm.raison}
              onChange={(e) => setIncForm({ ...incForm, raison: e.target.value })}
              placeholder="Réaction chimique, non compatible humidité..." />
            <label className="label">Sévérité</label>
            <select className="input mb-4" value={incForm.severite}
              onChange={(e) => setIncForm({ ...incForm, severite: e.target.value })}>
              <option value="avertissement">Avertissement</option>
              <option value="bloquant">Bloquant</option>
            </select>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowInc(false); setError(""); }} className="btn-ghost">Annuler</button>
              <button onClick={saveInc} className="btn-primary">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
