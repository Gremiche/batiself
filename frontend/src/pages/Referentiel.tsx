import { useEffect, useRef, useState } from "react";
import { api, CorpsMetier, Materiau, MateriauPayload, CorpsMetierPayload, MateriauStats } from "../api/client";

const EMPTY_MAT = (): MateriauPayload => ({
  nom: "", corps_metier: "", unite: "m²",
  ratio_consommation: 1, prix_unitaire: null,
  fournisseur: null, notes: null, reference_obat: null,
  conditionnement: null, unite_achat: null,
});

const UNITES = ["m²", "m", "m³", "u", "kg", "L", "ml", "unité", "forfait"];
const TAB_ALL = "__tous__";

type SortKey = "nom" | "corps_metier" | "unite" | "ratio_consommation" | "prix_unitaire";

export default function Referentiel() {
  const [materiaux, setMateriaux]         = useState<Materiau[]>([]);
  const [corpsMetiers, setCorpsMetiers]   = useState<CorpsMetier[]>([]);
  const [activeTab, setActiveTab]         = useState<string>(TAB_ALL);
  const [search, setSearch]               = useState("");

  // Tri
  const [sortKey, setSortKey]   = useState<SortKey>("nom");
  const [sortAsc, setSortAsc]   = useState(true);

  // Modal matériau
  const [form, setForm]         = useState<MateriauPayload>(EMPTY_MAT());
  const [editing, setEditing]   = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [matError, setMatError] = useState("");

  // Modal corps de métier
  const [showCM, setShowCM]       = useState(false);
  const [cmForm, setCmForm]       = useState<CorpsMetierPayload>({ nom: "", ordre: 0 });
  const [editingCM, setEditingCM] = useState<number | null>(null);
  const [cmError, setCmError]     = useState("");

  // Drawer détail matériau
  const [selectedMat, setSelectedMat]   = useState<Materiau | null>(null);
  const [stats, setStats]               = useState<MateriauStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Import Obat
  const [importMsg, setImportMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    const [mats, cms] = await Promise.all([api.getMateriaux(), api.getCorpsMetier()]);
    setMateriaux(mats);
    setCorpsMetiers(cms);
  };

  useEffect(() => { loadAll(); }, []);

  // ── Tri ──────────────────────────────────────────────────────────────────────
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="ml-1 text-white/40">⇅</span>;
    return <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>;
  };

  // ── Filtrage + tri ────────────────────────────────────────────────────────────
  const filtered = [...materiaux]
    .filter((m) => {
      const matchTab = activeTab === TAB_ALL || m.corps_metier === activeTab;
      const q = search.toLowerCase();
      const matchSearch = !q || m.nom.toLowerCase().includes(q) || m.corps_metier.toLowerCase().includes(q) || (m.fournisseur ?? "").toLowerCase().includes(q);
      return matchTab && matchSearch;
    })
    .sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "fr");
      return sortAsc ? cmp : -cmp;
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
    if (!form.nom.trim())          { setMatError("Le nom est obligatoire."); return; }
    if (!form.corps_metier.trim()) { setMatError("Le corps de métier est obligatoire."); return; }
    try {
      if (editing) await api.updateMateriau(editing, form);
      else         await api.createMateriau(form);
      await loadAll();
      closeMat();
      // Rafraîchir le drawer si le matériau édité est sélectionné
      if (selectedMat && editing === selectedMat.id) openDrawer(editing);
    } catch (e: any) { setMatError(e.message); }
  };

  const removeMat = async (id: number) => {
    if (!confirm("Supprimer ce matériau ?")) return;
    await api.deleteMateriau(id);
    if (selectedMat?.id === id) closeDrawer();
    loadAll();
  };

  const duplicateMat = async (id: number) => {
    const copy = await api.duplicateMateriau(id);
    await loadAll();
    openEdit(copy);
  };

  // ── Drawer détail ─────────────────────────────────────────────────────────
  const openDrawer = async (id: number) => {
    const mat = materiaux.find((m) => m.id === id) ?? null;
    setSelectedMat(mat);
    setStatsLoading(true);
    setStats(null);
    try {
      const s = await api.getMateriauStats(id);
      setStats(s);
    } finally {
      setStatsLoading(false);
    }
  };

  const closeDrawer = () => { setSelectedMat(null); setStats(null); };

  // Mettre à jour le mat sélectionné quand materiaux change
  useEffect(() => {
    if (selectedMat) {
      const updated = materiaux.find((m) => m.id === selectedMat.id);
      if (updated) setSelectedMat(updated);
    }
  }, [materiaux]);

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

  const matName = (id: number) => materiaux.find((m) => m.id === id)?.nom ?? `#${id}`;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-bleu">Référentiel matériaux</h1>
          <p className="text-gray-500 text-sm mt-1">{materiaux.length} matériau(x)</p>
        </div>
        <div className="flex gap-3 items-start flex-wrap justify-end">
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
          {/* Export CSV */}
          <button onClick={() => api.exportReferentielCsv()} className="btn-secondary flex items-center gap-2" title="Télécharger le référentiel en CSV">
            ⬇️ Export CSV
          </button>
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
        placeholder="Rechercher un matériau, fournisseur…"
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
                <th className="text-left px-4 py-3 cursor-pointer select-none hover:bg-bleu/80" onClick={() => toggleSort("nom")}>
                  Nom <SortIcon col="nom" />
                </th>
                {activeTab === TAB_ALL && (
                  <th className="text-left px-4 py-3 cursor-pointer select-none hover:bg-bleu/80" onClick={() => toggleSort("corps_metier")}>
                    Corps de métier <SortIcon col="corps_metier" />
                  </th>
                )}
                <th className="text-left px-4 py-3 cursor-pointer select-none hover:bg-bleu/80" onClick={() => toggleSort("unite")}>
                  Unité <SortIcon col="unite" />
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:bg-bleu/80" onClick={() => toggleSort("ratio_consommation")}>
                  Ratio <SortIcon col="ratio_consommation" />
                </th>
                <th className="text-right px-4 py-3 cursor-pointer select-none hover:bg-bleu/80" onClick={() => toggleSort("prix_unitaire")}>
                  Prix HT <SortIcon col="prix_unitaire" />
                </th>
                <th className="text-left px-4 py-3">Cond.</th>
                <th className="text-left px-4 py-3">Réf. Obat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.id}
                  className={`cursor-pointer transition-colors ${
                    selectedMat?.id === m.id
                      ? "bg-bleu/10"
                      : i % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50 hover:bg-gray-100"
                  }`}
                  onClick={() => selectedMat?.id === m.id ? closeDrawer() : openDrawer(m.id)}
                >
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
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
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

      {/* ── Drawer détail matériau ────────────────────────────────────────────── */}
      {selectedMat && (
        <div className="fixed inset-0 z-40 flex justify-end pointer-events-none">
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={closeDrawer}
          />
          <div className="relative w-full max-w-md bg-white shadow-2xl border-l border-gray-200 overflow-y-auto pointer-events-auto flex flex-col">
            {/* En-tête drawer */}
            <div className="bg-bleu text-white px-6 py-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{selectedMat.corps_metier}</p>
                <h2 className="text-xl font-bold mt-0.5">{selectedMat.nom}</h2>
              </div>
              <button onClick={closeDrawer} className="text-white/70 hover:text-white text-xl leading-none mt-1">✕</button>
            </div>

            <div className="p-6 flex-1 space-y-6">
              {/* Infos principales */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Informations</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Unité</p>
                    <p className="font-medium">{selectedMat.unite}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Ratio consommation</p>
                    <p className="font-medium">{selectedMat.ratio_consommation}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Prix unitaire HT</p>
                    <p className="font-medium">{selectedMat.prix_unitaire != null ? `${selectedMat.prix_unitaire.toFixed(2)} €` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Fournisseur</p>
                    <p className="font-medium">{selectedMat.fournisseur ?? "—"}</p>
                  </div>
                  {selectedMat.conditionnement && (
                    <div>
                      <p className="text-gray-400 text-xs">Conditionnement</p>
                      <p className="font-medium">{selectedMat.conditionnement} {selectedMat.unite}/{selectedMat.unite_achat ?? "u"}</p>
                    </div>
                  )}
                  {selectedMat.reference_obat && (
                    <div>
                      <p className="text-gray-400 text-xs">Réf. Obat</p>
                      <p className="font-medium font-mono text-xs">{selectedMat.reference_obat}</p>
                    </div>
                  )}
                </div>
                {selectedMat.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                    {selectedMat.notes}
                  </div>
                )}
              </section>

              {/* Stats */}
              {statsLoading && <p className="text-sm text-gray-400 animate-pulse">Chargement…</p>}

              {stats && (
                <>
                  {/* Utilisation */}
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Utilisation</h3>
                    <div className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium ${
                      stats.postes_count > 0 ? "bg-bleu/10 text-bleu" : "bg-gray-100 text-gray-400"
                    }`}>
                      <span className="text-2xl">{stats.postes_count > 0 ? "🔨" : "📦"}</span>
                      <span>
                        {stats.postes_count > 0
                          ? `Utilisé dans ${stats.postes_count} poste(s) de travaux`
                          : "Non utilisé dans les postes"}
                      </span>
                    </div>
                  </section>

                  {/* Dépendances */}
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      Dépendances ({stats.dependances.length})
                    </h3>
                    {stats.dependances.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucune dépendance</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.dependances.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <span className="text-gray-400 text-xs">└</span>
                            <span className="flex-1 font-medium">{matName(d.materiau_dependant_id)}</span>
                            <span className="text-xs text-gray-400">×{d.ratio}</span>
                            <span className="text-xs bg-bleu/10 text-bleu px-2 py-0.5 rounded-full">{d.type_dependance}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Incompatibilités */}
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                      Incompatibilités ({stats.incompatibilites.length})
                    </h3>
                    {stats.incompatibilites.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucune incompatibilité</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.incompatibilites.map((inc) => {
                          const autreId = inc.materiau_a_id === selectedMat.id ? inc.materiau_b_id : inc.materiau_a_id;
                          return (
                            <div key={inc.id} className="bg-orange/5 border border-orange/20 rounded-lg px-3 py-2 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-orange">⚠ {matName(autreId)}</span>
                                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                                  inc.severite === "bloquant" ? "bg-red-100 text-red-600" : "bg-orange/10 text-orange"
                                }`}>{inc.severite}</span>
                              </div>
                              <p className="text-gray-500 text-xs">{inc.raison}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>

            {/* Actions drawer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => openEdit(selectedMat)} className="btn-primary flex-1 text-sm">✏️ Modifier</button>
              <button onClick={() => duplicateMat(selectedMat.id)} className="btn-secondary text-sm">⎘ Dupliquer</button>
              <button onClick={() => removeMat(selectedMat.id)} className="btn-danger text-sm">🗑️</button>
            </div>
          </div>
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
