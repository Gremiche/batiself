import { useEffect, useRef, useState } from "react";
import { api, Materiau, MateriauPayload } from "../api/client";

const EMPTY: MateriauPayload = {
  nom: "", corps_metier: "", unite: "m²",
  ratio_consommation: 1, prix_unitaire: null,
  fournisseur: null, notes: null, reference_obat: null,
  conditionnement: null, unite_achat: null,
};

const UNITES = ["m²", "m", "m³", "u", "kg", "L", "ml", "forfait"];

export default function Referentiel() {
  const [materiaux, setMateriaux] = useState<Materiau[]>([]);
  const [form, setForm] = useState<MateriauPayload>(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => api.getMateriaux().then(setMateriaux);
  useEffect(() => { load(); }, []);

  const filtered = materiaux.filter(
    (m) =>
      m.nom.toLowerCase().includes(search.toLowerCase()) ||
      m.corps_metier.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (m: Materiau) => {
    setForm({
      nom: m.nom, corps_metier: m.corps_metier, unite: m.unite,
      ratio_consommation: m.ratio_consommation,
      prix_unitaire: m.prix_unitaire, fournisseur: m.fournisseur,
      notes: m.notes, reference_obat: m.reference_obat,
      conditionnement: m.conditionnement, unite_achat: m.unite_achat,
    });
    setEditing(m.id);
    setShowForm(true);
  };

  const close = () => { setShowForm(false); setError(""); };

  const save = async () => {
    if (!form.nom.trim()) { setError("Le nom est obligatoire."); return; }
    try {
      if (editing) await api.updateMateriau(editing, form);
      else await api.createMateriau(form);
      await load();
      close();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (id: number) => {
    if (!confirm("Supprimer ce matériau ?")) return;
    await api.deleteMateriau(id);
    load();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const res = await api.importObat(file);
      setImportMsg(`✅ ${res.message}`);
      await load();
    } catch (err: any) {
      setImportMsg(`❌ ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const byMetier = filtered.reduce<Record<string, Materiau[]>>((acc, m) => {
    (acc[m.corps_metier] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-bleu">Référentiel matériaux</h1>
          <p className="text-gray-500 text-sm mt-1">{materiaux.length} matériau(x) au total</p>
        </div>
        <div className="flex gap-3">
          {/* Bouton MAJ Obat */}
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="btn-secondary flex items-center gap-2"
            >
              {importing ? "⏳ Import..." : "🔄 MAJ référentiel Obat"}
            </button>
            {importMsg && (
              <p className={`text-xs ${importMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
                {importMsg}
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </div>
          <button onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }} className="btn-primary">
            + Ajouter
          </button>
        </div>
      </div>

      {/* Encadré explicatif import Obat */}
      <div className="bg-bleu/5 border border-bleu/20 rounded-xl p-4 mb-6 text-sm text-gray-600">
        <p className="font-semibold text-bleu mb-1">📥 Import depuis Obat</p>
        <p>
          Exportez votre catalogue depuis <strong>Obat → Bibliothèque → Ouvrages/Fournitures → Exporter CSV</strong>,
          puis cliquez sur <em>MAJ référentiel Obat</em> pour importer ou mettre à jour vos matériaux.
          Les colonnes reconnues : <code>Désignation, Unité, Prix unitaire HT, Famille, Référence, Fournisseur</code>.
        </p>
      </div>

      <input
        className="input mb-6"
        placeholder="Rechercher un matériau ou un corps de métier..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {Object.entries(byMetier).length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📦</p>
          <p className="font-medium">Référentiel vide</p>
          <p className="text-sm mt-1">Ajoutez des matériaux manuellement ou importez depuis Obat.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byMetier).map(([metier, mats]) => (
            <div key={metier}>
              <h2 className="text-sm font-bold text-orange uppercase tracking-widest mb-2">{metier}</h2>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bleu text-white text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Nom</th>
                      <th className="text-left px-4 py-3">Unité</th>
                      <th className="text-right px-4 py-3">Ratio</th>
                      <th className="text-right px-4 py-3">Prix HT</th>
                      <th className="text-left px-4 py-3">Cond.</th>
                      <th className="text-left px-4 py-3">Réf. Obat</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((m, i) => (
                      <tr key={m.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2.5 font-medium">{m.nom}</td>
                        <td className="px-4 py-2.5 text-gray-500">{m.unite}</td>
                        <td className="px-4 py-2.5 text-right">{m.ratio_consommation}</td>
                        <td className="px-4 py-2.5 text-right">
                          {m.prix_unitaire != null ? `${m.prix_unitaire.toFixed(2)} €` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {m.conditionnement
                            ? `${m.conditionnement} ${m.unite}/${m.unite_achat ?? "u"}`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{m.reference_obat ?? "—"}</td>
                        <td className="px-4 py-2.5 flex gap-1 justify-end">
                          <button onClick={() => openEdit(m)} className="btn-ghost text-xs py-1 px-2">✏️</button>
                          <button onClick={() => remove(m.id)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-bleu mb-5">
              {editing ? "Modifier le matériau" : "Nouveau matériau"}
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="label">Nom *</label>
                <input className="input" value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              </div>
              <div>
                <label className="label">Corps de métier</label>
                <input className="input" value={form.corps_metier}
                  onChange={(e) => setForm({ ...form, corps_metier: e.target.value })}
                  placeholder="Carrelage, Peinture..." />
              </div>
              <div>
                <label className="label">Unité</label>
                <select className="input" value={form.unite}
                  onChange={(e) => setForm({ ...form, unite: e.target.value })}>
                  {UNITES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ratio consommation</label>
                <input className="input" type="number" step="0.01" min="0"
                  value={form.ratio_consommation}
                  onChange={(e) => setForm({ ...form, ratio_consommation: parseFloat(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="label">Prix unitaire HT (€)</label>
                <input className="input" type="number" step="0.01" min="0"
                  value={form.prix_unitaire ?? ""}
                  onChange={(e) => setForm({ ...form, prix_unitaire: e.target.value ? parseFloat(e.target.value) : null })} />
              </div>
              <div>
                <label className="label">Fournisseur</label>
                <input className="input" value={form.fournisseur ?? ""}
                  onChange={(e) => setForm({ ...form, fournisseur: e.target.value || null })} />
              </div>
              <div>
                <label className="label">Référence Obat</label>
                <input className="input" value={form.reference_obat ?? ""}
                  onChange={(e) => setForm({ ...form, reference_obat: e.target.value || null })} />
              </div>
              <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
                <p className="text-xs font-semibold text-bleu uppercase tracking-wide mb-2">Conditionnement (achat)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Qté par colis ({form.unite})</label>
                    <input className="input" type="number" step="0.01" min="0"
                      value={form.conditionnement ?? ""}
                      placeholder={`Ex: 3 pour une plaque de 3 ${form.unite}`}
                      onChange={(e) => setForm({ ...form, conditionnement: e.target.value ? parseFloat(e.target.value) : null })} />
                  </div>
                  <div>
                    <label className="label">Nom du colis</label>
                    <input className="input" value={form.unite_achat ?? ""}
                      placeholder="plaque, sac, rouleau…"
                      onChange={(e) => setForm({ ...form, unite_achat: e.target.value || null })} />
                  </div>
                </div>
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input h-20 resize-none" value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value || null })} />
              </div>
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
