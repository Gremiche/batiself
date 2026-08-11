import { useEffect, useState } from "react";
import {
  api, Materiau,
  Dependance, DependancePayload,
  Incompatibilite, IncompatibilitePayload,
  TypePieceMateriauItem,
} from "../api/client";

const TYPES_PIECE = [
  { value: "pièce d'eau",   label: "Pièce d'eau" },
  { value: "pièce à vivre", label: "Pièce à vivre" },
  { value: "chambre",       label: "Chambre" },
  { value: "pièce morte",   label: "Pièce morte" },
];

const EMPTY_DEP = (): DependancePayload => ({
  materiau_principal_id: 0,
  materiau_dependant_id: 0,
  ratio: 1,
  type_dependance: "obligatoire",
  condition: null,
  usage: null,
});

const EMPTY_INC = (): IncompatibilitePayload => ({
  materiau_a_id: 0,
  materiau_b_id: 0,
  raison: "",
  severite: "avertissement",
});

export default function Regles() {
  const [materiaux, setMateriaux]                 = useState<Materiau[]>([]);
  const [dependances, setDependances]             = useState<Dependance[]>([]);
  const [incompatibilites, setIncompatibilites]   = useState<Incompatibilite[]>([]);
  const [typePieceMat, setTypePieceMat]           = useState<TypePieceMateriauItem[]>([]);
  const [tab, setTab]                             = useState<"dep" | "inc" | "sugg">("dep");

  // Dépendances
  const [depForm, setDepForm]         = useState<DependancePayload>(EMPTY_DEP());
  const [editingDep, setEditingDep]   = useState<number | null>(null);
  const [showDep, setShowDep]         = useState(false);

  // Incompatibilités
  const [incForm, setIncForm]         = useState<IncompatibilitePayload>(EMPTY_INC());
  const [editingInc, setEditingInc]   = useState<number | null>(null);
  const [showInc, setShowInc]         = useState(false);

  // Suggestions
  const [suggTypePiece, setSuggTypePiece]   = useState(TYPES_PIECE[0].value);
  const [suggMatId, setSuggMatId]           = useState(0);
  const [suggError, setSuggError]           = useState("");

  const [error, setError] = useState("");

  const load = async () => {
    const [mats, deps, incs, tpms] = await Promise.all([
      api.getMateriaux(),
      api.getDependances(),
      api.getIncompatibilites(),
      api.getTypePieceMateriau(),
    ]);
    setMateriaux(mats);
    setDependances(deps);
    setIncompatibilites(incs);
    setTypePieceMat(tpms);
  };

  useEffect(() => { load(); }, []);

  const matName = (id: number) => materiaux.find((m) => m.id === id)?.nom ?? `#${id}`;

  // ── Dépendances ───────────────────────────────────────────────────────────
  const openCreateDep = () => { setDepForm(EMPTY_DEP()); setEditingDep(null); setError(""); setShowDep(true); };
  const openEditDep   = (d: Dependance) => {
    setDepForm({
      materiau_principal_id: d.materiau_principal_id,
      materiau_dependant_id: d.materiau_dependant_id,
      ratio: d.ratio,
      type_dependance: d.type_dependance,
      condition: d.condition,
      usage: d.usage,
    });
    setEditingDep(d.id);
    setError("");
    setShowDep(true);
  };

  const saveDep = async () => {
    if (!depForm.materiau_principal_id || !depForm.materiau_dependant_id) {
      setError("Sélectionnez les deux matériaux."); return;
    }
    try {
      if (editingDep) await api.updateDependance(editingDep, depForm);
      else            await api.createDependance(depForm);
      await load();
      setShowDep(false); setError("");
    } catch (e: any) { setError(e.message); }
  };

  // ── Incompatibilités ──────────────────────────────────────────────────────
  const openCreateInc = () => { setIncForm(EMPTY_INC()); setEditingInc(null); setError(""); setShowInc(true); };
  const openEditInc   = (inc: Incompatibilite) => {
    setIncForm({
      materiau_a_id: inc.materiau_a_id,
      materiau_b_id: inc.materiau_b_id,
      raison: inc.raison,
      severite: inc.severite,
    });
    setEditingInc(inc.id);
    setError("");
    setShowInc(true);
  };

  const saveInc = async () => {
    if (!incForm.materiau_a_id || !incForm.materiau_b_id) {
      setError("Sélectionnez les deux matériaux."); return;
    }
    if (!incForm.raison.trim()) { setError("La raison est obligatoire."); return; }
    try {
      if (editingInc) await api.updateIncompatibilite(editingInc, incForm);
      else            await api.createIncompatibilite(incForm);
      await load();
      setShowInc(false); setError("");
    } catch (e: any) { setError(e.message); }
  };

  // ── Suggestions par type de pièce ─────────────────────────────────────────
  const addSugg = async () => {
    if (!suggMatId) { setSuggError("Sélectionnez un matériau."); return; }
    try {
      await api.createTypePieceMateriau({ type_piece: suggTypePiece, materiau_id: suggMatId });
      setSuggMatId(0); setSuggError("");
      await load();
    } catch (e: any) { setSuggError(e.message); }
  };

  const removeSugg = async (id: number) => {
    await api.deleteTypePieceMateriau(id);
    load();
  };

  const MatSelect = ({ value, onChange }: { value: number; onChange: (id: number) => void }) => (
    <select className="input" value={value || ""} onChange={(e) => onChange(Number(e.target.value))}>
      <option value="">-- Sélectionner --</option>
      {materiaux.map((m) => (
        <option key={m.id} value={m.id}>[{m.corps_metier}] {m.nom}</option>
      ))}
    </select>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-bleu mb-2">Règles matériaux</h1>
      <p className="text-gray-500 text-sm mb-6">Dépendances, incompatibilités et recommandations par type de pièce.</p>

      {/* Onglets */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "dep"  as const, label: `Dépendances (${dependances.length})` },
          { key: "inc"  as const, label: `Incompatibilités (${incompatibilites.length})` },
          { key: "sugg" as const, label: `Recommandations (${typePieceMat.length})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg font-semibold text-sm transition-colors ${
              tab === key ? "bg-bleu text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Dépendances ──────────────────────────────────────────────────────── */}
      {tab === "dep" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openCreateDep} className="btn-primary">+ Nouvelle dépendance</button>
          </div>
          {dependances.length === 0 ? (
            <div className="card text-center py-10 text-gray-400"><p>Aucune dépendance définie.</p></div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-bleu text-white text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3">Matériau principal</th>
                    <th className="text-left px-4 py-3">Dépendant</th>
                    <th className="text-right px-4 py-3">Ratio</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Usage</th>
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
                      <td className="px-4 py-2.5 text-xs">
                        {d.usage
                          ? <span className="bg-orange/10 text-orange px-2 py-0.5 rounded-full font-medium">{d.usage}</span>
                          : <span className="text-gray-400">Tous</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEditDep(d)} className="btn-ghost text-xs py-1 px-2">✏️</button>
                          <button onClick={() => api.deleteDependance(d.id).then(load)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Incompatibilités ─────────────────────────────────────────────────── */}
      {tab === "inc" && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={openCreateInc} className="btn-primary">+ Nouvelle incompatibilité</button>
          </div>
          {incompatibilites.length === 0 ? (
            <div className="card text-center py-10 text-gray-400"><p>Aucune incompatibilité définie.</p></div>
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
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEditInc(inc)} className="btn-ghost text-xs py-1 px-2">✏️</button>
                          <button onClick={() => api.deleteIncompatibilite(inc.id).then(load)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Recommandations par type de pièce ────────────────────────────────── */}
      {tab === "sugg" && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            Définissez quels matériaux sont suggérés par défaut selon le type de pièce (pièce d'eau, chambre…).
          </p>

          {/* Formulaire d'ajout */}
          <div className="card mb-6">
            <h3 className="font-semibold text-bleu mb-3">Ajouter une recommandation</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Type de pièce</label>
                <select className="input" value={suggTypePiece} onChange={(e) => setSuggTypePiece(e.target.value)}>
                  {TYPES_PIECE.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Matériau recommandé</label>
                <select className="input" value={suggMatId || ""} onChange={(e) => setSuggMatId(Number(e.target.value))}>
                  <option value="">-- Sélectionner --</option>
                  {materiaux.map((m) => (
                    <option key={m.id} value={m.id}>[{m.corps_metier}] {m.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            {suggError && <p className="text-red-500 text-sm mb-2">{suggError}</p>}
            <div className="flex justify-end">
              <button onClick={addSugg} className="btn-primary text-sm">+ Ajouter</button>
            </div>
          </div>

          {/* Liste par type de pièce */}
          {TYPES_PIECE.map(({ value, label }) => {
            const items = typePieceMat.filter((t) => t.type_piece === value);
            return (
              <div key={value} className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-bleu">▸</span> {label}
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{items.length}</span>
                </h3>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 ml-4">Aucune recommandation</p>
                ) : (
                  <div className="card p-0 overflow-hidden">
                    {items.map((tpm, i) => (
                      <div
                        key={tpm.id}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      >
                        <span className="flex-1 font-medium">{matName(tpm.materiau_id)}</span>
                        <span className="text-xs text-gray-400">
                          {materiaux.find((m) => m.id === tpm.materiau_id)?.corps_metier ?? ""}
                        </span>
                        <button onClick={() => removeSugg(tpm.id)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── Modal dépendance ─────────────────────────────────────────────────── */}
      {showDep && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-bleu mb-5">
              {editingDep ? "Modifier la dépendance" : "Nouvelle dépendance"}
            </h2>
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
            <input className="input mb-3" value={depForm.condition ?? ""}
              onChange={(e) => setDepForm({ ...depForm, condition: e.target.value || null })}
              placeholder="si support = béton..." />
            <label className="label">Usage (optionnel)</label>
            <select className="input mb-4" value={depForm.usage ?? ""}
              onChange={(e) => setDepForm({ ...depForm, usage: e.target.value || null })}>
              <option value="">Tous les usages</option>
              <option value="Mur">Mur</option>
              <option value="Sol">Sol</option>
              <option value="Plafond">Plafond</option>
            </select>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowDep(false); setError(""); }} className="btn-ghost">Annuler</button>
              <button onClick={saveDep} className="btn-primary">{editingDep ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal incompatibilité ─────────────────────────────────────────────── */}
      {showInc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-bleu mb-5">
              {editingInc ? "Modifier l'incompatibilité" : "Nouvelle incompatibilité"}
            </h2>
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
              <button onClick={saveInc} className="btn-primary">{editingInc ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
