import { useEffect, useRef, useState } from "react";
import { api, CorpsMetier, Materiau, MateriauPayload, CorpsMetierPayload } from "../api/client";

const EMPTY_MAT = (): MateriauPayload => ({
  nom: "", corps_metier: "", unite: "m²",
  ratio_consommation: 1, prix_unitaire: null,
  fournisseur: null, notes: null, reference_obat: null,
  conditionnement: null, unite_achat: null,
});

const UNITES = ["m²", "m", "m³", "u", "kg", "L", "ml", "unité", "forfait"];
const TAB_ALL = "__tous__";

export default function Referentiel() {
  const [materiaux, setMateriaux]         = useState<Materiau[]>([]);
  const [corpsMetiers, setCorpsMetiers]   = useState<CorpsMetier[]>([]);
  const [activeTab, setActiveTab]         = useState<string>(TAB_ALL);
  const [search, setSearch]               = useState("");

  // Modal matériau
  const [form, setForm]       = useState<MateriauPayload>(EMPTY_MAT());
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [matError, setMatError] = useState("");

  // Modal corps de métier
  const [showCM, setShowCM]         = useState(false);
  const [cmForm, setCmForm]         = useState<CorpsMetierPayload>({ nom: "", ordre: 0 });
  const [editingCM, setEditingCM]   = useState<number | null>(null);
  const [cmError, setCmError]       = useState("");

  // Import Obat
  const [importMsg, setImportMsg]   = useState("");
  const [importing, setImporting]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    const [mats, cms] = await Promise.all([api.getMateriaux(), api.getCorpsMetier()]);
    setMateriaux(mats);
    setCorpsMetiers(cms);
  };

  useEffect(() => { loadAll(); }, []);

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const filtered = materiaux.filter((m) => {
    const matchTab = activeTab === TAB_ALL || m.corps_metier === activeTab;
    const q = search.toLowerCase();
    const matchSearch = !q || m.nom.toLowerCase().includes(q) || m.corps_metier.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  // ── Matériau : ouvrir édition ─────────────────────────────────────────────
  const openEdit = (m: Materiau) => {
    setForm({
      nom: m.nom, corps_metier: m.corps_metier, unite: m.unite,
      ratio_consommation: m.ratio_consommation,
      prix_unitaire: m.prix_unitaire, fournisseur: m.fournisseur,
      notes: m.notes, reference_obat: m.reference_obat,
      conditionnement: m.conditionnement, unite_achat: m.unite_achat,
    });
    setEditing(m.id);
    setMatError("");
    setShowForm(true);
  };

  const openCreate = () => {
    setForm({ ...EMPTY_MAT(), corps_metier: activeTab !== TAB_ALL ? activeTab : "" });
    setEditing(null);
    setMatError("");
    setShowForm(true);
  };

  const closeMat = () => { setShowForm(false); setMatError(""); };

  const saveMat = async () => {
    if (!form.nom.trim())         { setMatError("Le nom est obligatoire."); return; }
    if (!form.corps_metier.trim()){ setMatError("Le corps de métier est obligatoire."); return; }
    try {
      if (editing) await api.updateMateriau(editing, form);
      else         await api.createMateriau(form);
      await loadAll();
      closeMat();
    } catch (e: any) { setMatError(e.message); }
  };

  const removeMat = async (id: number) => {
    if (!confirm("Supprimer ce matériau ?")) return;
    await api.deleteMateriau(id);
    loadAll();
  };

  const duplicateMat = async (id: number) => {
    const copy = await api.duplicateMateriau(id);
    await loadAll();
    openEdit(copy);
  };

  // ── Import Obat ───────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg("");
    try {
      const res = await api.importObat(file);
      setImportMsg(`✅ ${res.message}`);
      await loadAll();
    } catch (err: any) {
      setImportMsg(`❌ ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ── Corps de métier : CRUD ────────────────────────────────────────────────
  const openCreateCM = () => {
    const last = corpsMetiers[corpsMetiers.length - 1];
    setCmForm({ nom: "", ordre: (last?.ordre ?? 0) + 10 });
    setEditingCM(null); setCmError(""); setShowCM(true);
  };
  const openEditCM = (cm: CorpsMetier) => {
    setCmForm({ nom: cm.nom, ordre: cm.ordre });
    setEditingCM(cm.id); setCmError(""); setShowCM(true);
  };
  const closeCM = () => { setShowCM(false); setCmError(""); };
  const saveCM = async () => {
    if (!cmForm.nom.trim()) { setCmError("Le nom est obligatoire."); return; }
    try {
      if (editingCM) await api.updateCorpsMetier(editingCM, cmForm);
      else           await api.createCorpsMetier(cmForm);
      await loadAll();
      closeCM();
    } catch (e: any) { setCmError(e.message); }
  };
  const removeCM = async (id: number, nom: string) => {
    if (!confirm(`Supprimer le corps de métier "${nom}" ?`)) return;
    try {
      await api.deleteCorpsMetier(id);
      if (activeTab === nom) setActiveTab(TAB_ALL);
      await loadAll();
    } catch (e: any) { alert(e.message); }
  };

  // ── Tabs list ─────────────────────────────────────────────────────────────
  const tabs = [
    { key: TAB_ALL, label: "Tous", count: materiaux.length },
    ...corpsMetiers.map((cm) => ({
      key: cm.nom,
      label: cm.nom,
      count: materiaux.filter((m) => m.corps_metier === cm.nom).length,
    })),
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-bleu">Référentiel matériaux</h1>
          <p className="text-gray-500 text-sm mt-1">{materiaux.length} matériau(x)</p>
        </div>
        <div className="flex gap-3 items-start">
          {/* Import Obat */}
          <div className="flex flex-col items-end gap-1">
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary flex items-center gap-2">
              {importing ? "⏳ Import..." : "🔄 MAJ Obat"}
            </button>
            {importMsg && (
              <p className={`text-xs ${importMsg.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>{importMsg}</p>
            )}
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
          </div>
          {/* Gérer corps de métier */}
          <button onClick={openCreateCM} className="btn-secondary flex items-center gap-2">
            ⚙️ Corps de métier
          </button>
          {/* Ajouter matériau */}
          <button onClick={openCreate} className="btn-primary">+ Ajouter</button>
        </div>
      </div>

      {/* Barre de recherche */}
      <input
        className="input mb-4"
        placeholder="Rechercher un matériau…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Onglets */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              activeTab === t.key
                ? "bg-bleu text-white"
                : "text-gray-500 hover:text-bleu hover:bg-bleu/5"
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">📦</p>
          <p className="font-medium">{search ? "Aucun résultat" : "Aucun matériau"}</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bleu text-white text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Nom</th>
                {activeTab === TAB_ALL && <th className="text-left px-4 py-3">Corps de métier</th>}
                <th className="text-left px-4 py-3">Unité</th>
                <th className="text-right px-4 py-3">Ratio</th>
                <th className="text-right px-4 py-3">Prix HT</th>
                <th className="text-left px-4 py-3">Cond.</th>
                <th className="text-left px-4 py-3">Réf. Obat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-2.5 font-medium">{m.nom}</td>
                  {activeTab === TAB_ALL && (
                    <td className="px-4 py-2.5">
                      <span className="bg-bleu/10 text-bleu text-xs font-medium px-2 py-0.5 rounded-full">
                        {m.corps_metier}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-gray-500">{m.unite}</td>
                  <td className="px-4 py-2.5 text-right">{m.ratio_consommation}</td>
                  <td className="px-4 py-2.5 text-right">
                    {m.prix_unitaire != null ? `${m.prix_unitaire.toFixed(2)} €` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {m.conditionnement ? `${m.conditionnement} ${m.unite}/${m.unite_achat ?? "u"}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{m.reference_obat ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => duplicateMat(m.id)} title="Dupliquer" className="btn-ghost text-xs py-1 px-2">⎘</button>
                      <button onClick={() => openEdit(m)} title="Modifier" className="btn-ghost text-xs py-1 px-2">✏️</button>
                      <button onClick={() => removeMat(m.id)} title="Supprimer" className="btn-danger text-xs py-1 px-2">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal matériau ──────────────────────────────────────────────────── */}
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
              <div className="col-span-2">
                <label className="label">Corps de métier *</label>
                <select className="input" value={form.corps_metier}
                  onChange={(e) => setForm({ ...form, corps_metier: e.target.value })}>
                  <option value="">— Sélectionner —</option>
                  {corpsMetiers.map((cm) => (
                    <option key={cm.id} value={cm.nom}>{cm.nom}</option>
                  ))}
                </select>
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

            {matError && <p className="text-red-500 text-sm mb-3">{matError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={closeMat} className="btn-ghost">Annuler</button>
              <button onClick={saveMat} className="btn-primary">{editing ? "Enregistrer" : "Créer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal corps de métier ───────────────────────────────────────────── */}
      {showCM && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-bleu">Corps de métier</h2>
              <button onClick={closeCM} className="btn-ghost text-sm">✕ Fermer</button>
            </div>

            {/* Liste existants */}
            <div className="space-y-2 mb-5">
              {corpsMetiers.map((cm) => (
                <div key={cm.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm font-medium">{cm.nom}</span>
                  <span className="text-xs text-gray-400 w-16 text-right">
                    {materiaux.filter((m) => m.corps_metier === cm.nom).length} mat.
                  </span>
                  <button onClick={() => openEditCM(cm)} className="btn-ghost text-xs py-1 px-2">✏️</button>
                  <button onClick={() => removeCM(cm.id, cm.nom)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                </div>
              ))}
            </div>

            {/* Formulaire ajout/édition */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-bleu mb-3">
                {editingCM ? "Modifier" : "Nouveau corps de métier"}
              </p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="label">Nom *</label>
                  <input className="input" value={cmForm.nom}
                    placeholder="Ex : Plâtrerie, Carrelage…"
                    onChange={(e) => setCmForm({ ...cmForm, nom: e.target.value })} />
                </div>
                <div>
                  <label className="label">Ordre d'affichage</label>
                  <input className="input" type="number" step="10" min="0"
                    value={cmForm.ordre}
                    onChange={(e) => setCmForm({ ...cmForm, ordre: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              {cmError && <p className="text-red-500 text-sm mb-3">{cmError}</p>}
              <div className="flex gap-3 justify-end">
                {editingCM && (
                  <button onClick={() => { setEditingCM(null); setCmForm({ nom: "", ordre: 0 }); setCmError(""); }}
                    className="btn-ghost text-sm">Annuler</button>
                )}
                <button onClick={saveCM} className="btn-primary text-sm">
                  {editingCM ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
