import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, Chantier, Piece, PiecePayload } from "../api/client";

const TYPE_OPTIONS = [
  { value: "pièce d'eau", label: "Pièce d'eau" },
  { value: "pièce à vivre", label: "Pièce à vivre" },
  { value: "chambre", label: "Chambre" },
  { value: "pièce morte", label: "Pièce morte" },
];

const EMPTY_PIECE = (chantierId: number): PiecePayload => ({
  chantier_id: chantierId,
  libelle: "",
  longueur: 0,
  largeur: 0,
  hauteur: 2.5,
  type_piece: "pièce à vivre",
  surface_ouvertures: 0,
});

export default function ChantierDetail() {
  const { id } = useParams<{ id: string }>();
  const chantierId = Number(id);
  const navigate = useNavigate();

  const [chantier, setChantier] = useState<Chantier | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [form, setForm] = useState<PiecePayload>(EMPTY_PIECE(chantierId));
  const [editing, setEditing] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [c, ps] = await Promise.all([
      api.getChantier(chantierId),
      api.getPieces(chantierId),
    ]);
    setChantier(c);
    setPieces(ps);
  };

  useEffect(() => { load(); }, [chantierId]);

  const openCreate = () => {
    setForm(EMPTY_PIECE(chantierId));
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p: Piece) => {
    setForm({
      chantier_id: chantierId,
      libelle: p.libelle,
      longueur: p.longueur,
      largeur: p.largeur,
      hauteur: p.hauteur,
      type_piece: p.type_piece,
      surface_ouvertures: p.surface_ouvertures,
    });
    setEditing(p.id);
    setShowForm(true);
  };

  const close = () => { setShowForm(false); setError(""); };

  const save = async () => {
    if (!form.libelle.trim()) { setError("Le libellé est obligatoire."); return; }
    try {
      if (editing) await api.updatePiece(editing, form);
      else await api.createPiece(form);
      await load();
      close();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (pid: number) => {
    if (!confirm("Supprimer cette pièce et tous ses postes ?")) return;
    await api.deletePiece(pid);
    load();
  };

  const handleExport = () => {
    setExporting(true);
    api.exportPdf(chantierId);
    setTimeout(() => setExporting(false), 2000);
  };

  const f = (n: number) => n.toFixed(2);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate("/")} className="text-sm text-gray-500 hover:text-bleu mb-6 flex items-center gap-1">
        ← Retour aux chantiers
      </button>

      {chantier && (
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-bleu">{chantier.nom}</h1>
            {chantier.description && (
              <p className="text-gray-500 mt-1">{chantier.description}</p>
            )}
            <p className="text-orange text-sm font-semibold mt-2">
              {pieces.length} pièce{pieces.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/chantier/${chantierId}/synthese`)}
              className="btn-secondary flex items-center gap-2"
            >
              📋 Synthèse
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary flex items-center gap-2"
            >
              {exporting ? "⏳" : "📄"} Export PDF
            </button>
            <button onClick={openCreate} className="btn-primary">+ Ajouter une pièce</button>
          </div>
        </div>
      )}

      {pieces.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🚪</p>
          <p className="text-lg font-medium">Aucune pièce</p>
          <p className="text-sm mt-1">Ajoutez des pièces pour commencer à planifier vos travaux.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {pieces.map((p) => (
            <div key={p.id} className="card hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <button
                  className="text-left flex-1"
                  onClick={() => navigate(`/piece/${p.id}`)}
                >
                  <p className="font-bold text-bleu text-lg">{p.libelle}</p>
                  <span className="inline-block mt-1 text-xs bg-orange/10 text-orange px-2 py-0.5 rounded-full font-medium">
                    {p.type_piece}
                  </span>
                </button>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => openEdit(p)} className="btn-ghost text-xs py-1 px-2">✏️</button>
                  <button onClick={() => remove(p.id)} className="btn-danger text-xs py-1 px-2">🗑️</button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Sol</p>
                  <p className="font-bold text-bleu">{f(p.surface_sol)} m²</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Murs</p>
                  <p className="font-bold text-bleu">{f(p.surface_murs)} m²</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Volume</p>
                  <p className="font-bold text-bleu">{f(p.volume)} m³</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {p.longueur}m × {p.largeur}m × {p.hauteur}m
              </p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-bleu mb-5">
              {editing ? "Modifier la pièce" : "Nouvelle pièce"}
            </h2>

            <label className="label">Libellé *</label>
            <input className="input mb-3" value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              placeholder="Cuisine, Salle de bain..." />

            <label className="label">Type de pièce</label>
            <select className="input mb-3" value={form.type_piece}
              onChange={(e) => setForm({ ...form, type_piece: e.target.value })}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-3 mb-3">
              {(["longueur", "largeur", "hauteur"] as const).map((dim) => (
                <div key={dim}>
                  <label className="label capitalize">{dim} (m)</label>
                  <input className="input" type="number" step="0.01" min="0"
                    value={form[dim]}
                    onChange={(e) => setForm({ ...form, [dim]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
            </div>

            <label className="label">Surface ouvertures (m²)</label>
            <input className="input mb-4" type="number" step="0.01" min="0"
              value={form.surface_ouvertures}
              onChange={(e) => setForm({ ...form, surface_ouvertures: parseFloat(e.target.value) || 0 })}
              placeholder="0" />

            {form.longueur > 0 && form.largeur > 0 && (
              <div className="bg-bleu/5 rounded-lg p-3 mb-4 grid grid-cols-3 gap-2 text-sm text-center">
                <div>
                  <p className="text-xs text-gray-500">Sol</p>
                  <p className="font-bold text-bleu">{(form.longueur * form.largeur).toFixed(2)} m²</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Murs</p>
                  <p className="font-bold text-bleu">
                    {Math.max(0, 2 * (form.longueur + form.largeur) * form.hauteur - form.surface_ouvertures).toFixed(2)} m²
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Volume</p>
                  <p className="font-bold text-bleu">{(form.longueur * form.largeur * form.hauteur).toFixed(2)} m³</p>
                </div>
              </div>
            )}

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
