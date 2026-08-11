import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Chantier, ChantierPayload } from "../api/client";

const EMPTY: ChantierPayload = { nom: "", description: "", marge_securite: 0 };

export default function Chantiers() {
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [form, setForm] = useState<ChantierPayload>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = () => api.getChantiers().then(setChantiers).catch(console.error);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (c: Chantier) => {
    setForm({ nom: c.nom, description: c.description, marge_securite: c.marge_securite ?? 0 });
    setEditing(c.id);
    setShowForm(true);
  };
  const close = () => { setShowForm(false); setError(""); };

  const save = async () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire."); return; }
    try {
      if (editing) await api.updateChantier(editing, form);
      else await api.createChantier(form);
      await load();
      close();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer ce chantier et toutes ses pièces ?")) return;
    await api.deleteChantier(id);
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-bleu">Chantiers</h1>
          <p className="text-gray-500 text-sm mt-1">{chantiers.length} chantier(s) en cours</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Nouveau chantier</button>
      </div>

      {chantiers.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🏗️</p>
          <p className="text-lg font-medium">Aucun chantier pour l'instant</p>
          <p className="text-sm mt-1">Créez votre premier chantier pour commencer.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {chantiers.map((c) => (
            <div key={c.id} className="card flex items-center justify-between hover:shadow-md transition-shadow">
              <button className="flex-1 text-left" onClick={() => navigate(`/chantier/${c.id}`)}>
                <p className="font-bold text-bleu text-lg">{c.nom}</p>
                {c.description && <p className="text-gray-500 text-sm mt-0.5">{c.description}</p>}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-orange font-semibold">
                    {c.nb_pieces} pièce{c.nb_pieces !== 1 ? "s" : ""}
                  </span>
                  {(c.marge_securite ?? 0) > 0 && (
                    <span className="text-xs bg-bleu/10 text-bleu px-2 py-0.5 rounded-full font-medium">
                      Marge +{c.marge_securite}%
                    </span>
                  )}
                </div>
              </button>
              <div className="flex gap-2 ml-4">
                <button onClick={() => openEdit(c)} className="btn-ghost text-sm py-1.5">Modifier</button>
                <button onClick={() => remove(c.id)} className="btn-danger text-sm py-1.5">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-bleu mb-5">
              {editing ? "Modifier le chantier" : "Nouveau chantier"}
            </h2>
            <label className="label">Nom *</label>
            <input
              className="input mb-3"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Rénovation appartement T3..."
            />
            <label className="label">Description</label>
            <textarea
              className="input mb-3 h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Informations complémentaires..."
            />
            <label className="label">Marge de sécurité (%)</label>
            <div className="flex items-center gap-2 mb-4">
              <input
                className="input w-28"
                type="number" min="0" max="50" step="1"
                value={form.marge_securite}
                onChange={(e) => setForm({ ...form, marge_securite: parseFloat(e.target.value) || 0 })}
              />
              <span className="text-sm text-gray-500">
                {form.marge_securite > 0
                  ? `+${form.marge_securite}% appliqué sur toutes les quantités`
                  : "Aucune marge (quantités exactes)"}
              </span>
            </div>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={close} className="btn-ghost">Annuler</button>
              <button onClick={save} className="btn-primary">{editing ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
