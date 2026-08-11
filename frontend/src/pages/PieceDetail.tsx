import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  api, Piece, Poste, PostePayload, Materiau,
  CalcResult, Alerte,
} from "../api/client";

type BaseRef = "sol" | "murs" | "volume" | "perimetre" | "manuel";

function getBaseRef(unite: string): BaseRef {
  const u = unite.toLowerCase();
  if (u === "m³") return "volume";
  if (u === "m") return "perimetre";
  if (u === "m²") return "sol";
  return "manuel";
}

function computeQuantite(base: BaseRef, piece: Piece): number {
  switch (base) {
    case "sol":       return piece.surface_sol;
    case "murs":      return piece.surface_murs;
    case "volume":    return piece.volume;
    case "perimetre": return parseFloat((2 * (piece.longueur + piece.largeur)).toFixed(2));
    default:          return 0;
  }
}

const BASE_LABELS: Record<BaseRef, string> = {
  sol:       "Surface sol",
  murs:      "Surface murs",
  volume:    "Volume",
  perimetre: "Périmètre",
  manuel:    "Manuel",
};

export default function PieceDetail() {
  const { id } = useParams<{ id: string }>();
  const pieceId = Number(id);
  const navigate = useNavigate();

  const [piece, setPiece] = useState<Piece | null>(null);
  const [postes, setPostes] = useState<Poste[]>([]);
  const [materiaux, setMateriaux] = useState<Materiau[]>([]);
  const [suggestions, setSuggestions] = useState<Materiau[]>([]);
  const [calculs, setCalculs] = useState<Record<number, CalcResult>>({});
  const [alertes, setAlertes] = useState<Alerte[]>([]);

  const [form, setForm] = useState<PostePayload>({
    piece_id: pieceId,
    corps_metier: "",
    materiau_principal_id: 0,
    quantite_reference: 0,
    commentaire: null,
  });
  const [baseRef, setBaseRef] = useState<BaseRef>("manuel");
  const [selectedMat, setSelectedMat] = useState<Materiau | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Autocomplete state
  const [acSearch, setAcSearch] = useState("");
  const [acOpen, setAcOpen] = useState(false);
  const acRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [p, ps, mats, sug, inc] = await Promise.all([
      api.getPiece(pieceId),
      api.getPostes(pieceId),
      api.getMateriaux(),
      api.getSuggestions(pieceId),
      api.checkIncompatibilites(pieceId),
    ]);
    setPiece(p);
    setPostes(ps);
    setMateriaux(mats);
    setSuggestions(sug);
    setAlertes(inc.alertes);

    const results: Record<number, CalcResult> = {};
    await Promise.all(
      ps.map(async (post) => {
        results[post.id] = await api.calculPoste(post.id);
      })
    );
    setCalculs(results);
  };

  useEffect(() => { load(); }, [pieceId]);

  const close = () => {
    setShowForm(false);
    setError("");
    setSelectedMat(null);
    setBaseRef("manuel");
    setAcSearch("");
    setAcOpen(false);
  };

  const openForm = () => {
    setForm({ piece_id: pieceId, corps_metier: "", materiau_principal_id: 0, quantite_reference: 0, commentaire: null });
    setSelectedMat(null);
    setBaseRef("manuel");
    setAcSearch("");
    setAcOpen(false);
    setShowForm(true);
  };

  // Close autocomplete dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) {
        setAcOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectMateriau = (matId: number) => {
    if (!piece) return;
    const m = materiaux.find((m) => m.id === matId);
    if (!m) return;
    setSelectedMat(m);
    const base = getBaseRef(m.unite);
    setBaseRef(base);
    const qte = base !== "manuel" ? computeQuantite(base, piece) : 0;
    setForm({ ...form, materiau_principal_id: matId, corps_metier: m.corps_metier, quantite_reference: qte });
  };

  const handleChangeBase = (newBase: BaseRef) => {
    if (!piece) return;
    setBaseRef(newBase);
    const qte = newBase !== "manuel" ? computeQuantite(newBase, piece) : form.quantite_reference;
    setForm((f) => ({ ...f, quantite_reference: qte }));
  };

  const save = async () => {
    if (!form.materiau_principal_id) { setError("Sélectionnez un matériau."); return; }
    if (form.quantite_reference <= 0) { setError("La quantité doit être > 0."); return; }
    try {
      await api.createPoste(form);
      await load();
      close();
    } catch (e: any) { setError(e.message); }
  };

  const remove = async (pid: number) => {
    await api.deletePoste(pid);
    load();
  };

  const totalPiece = () => {
    let t = 0;
    Object.values(calculs).forEach((c) => c.lignes.forEach((l) => { t += l.total; }));
    return t;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {piece && (
        <>
          <button
            onClick={() => navigate(`/chantier/${piece.chantier_id}`)}
            className="text-sm text-gray-500 hover:text-bleu mb-6 flex items-center gap-1"
          >
            ← Retour au chantier
          </button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-bleu">{piece.libelle}</h1>
              <span className="inline-block mt-1 text-sm bg-orange/10 text-orange px-3 py-0.5 rounded-full font-medium">
                {piece.type_piece}
              </span>
            </div>
            <button onClick={openForm} className="btn-primary">+ Ajouter un poste</button>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Surface sol",  val: `${piece.surface_sol.toFixed(2)} m²` },
              { label: "Surface murs", val: `${piece.surface_murs.toFixed(2)} m²` },
              { label: "Volume",       val: `${piece.volume.toFixed(2)} m³` },
              { label: "Périmètre",    val: `${(2*(piece.longueur+piece.largeur)).toFixed(2)} m` },
            ].map(({ label, val }) => (
              <div key={label} className="card text-center">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-xl font-bold text-bleu mt-0.5">{val}</p>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="bg-orange/5 border border-orange/20 rounded-xl p-4 mb-6">
              <p className="text-sm font-semibold text-orange mb-2">
                💡 Matériaux suggérés pour ce type de pièce
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <span key={s.id} className="bg-white border border-orange/30 text-sm px-3 py-1 rounded-full text-gray-700">
                    {s.nom} <span className="text-gray-400">({s.corps_metier})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alertes incompatibilités */}
          {alertes.length > 0 && (
            <div className="mb-6 space-y-2">
              {alertes.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-4 flex items-start gap-3 ${
                    a.severite === "bloquant"
                      ? "bg-red-50 border border-red-200"
                      : "bg-yellow-50 border border-yellow-200"
                  }`}
                >
                  <span className="text-xl">{a.severite === "bloquant" ? "🚫" : "⚠️"}</span>
                  <div>
                    <p className="font-semibold text-sm">
                      {a.materiau_a} + {a.materiau_b}
                      <span className={`ml-2 ${a.severite === "bloquant" ? "badge-bloquant" : "badge-avertissement"}`}>
                        {a.severite}
                      </span>
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">{a.raison}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Postes de travaux */}
          {postes.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <p className="text-3xl mb-2">🔧</p>
              <p className="font-medium">Aucun poste de travaux</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postes.map((poste) => {
                const calc = calculs[poste.id];
                return (
                  <div key={poste.id} className="card">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="font-bold text-bleu">
                          {materiaux.find((m) => m.id === poste.materiau_principal_id)?.nom ?? "—"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {poste.corps_metier} · réf. {poste.quantite_reference}
                        </p>
                        {calc?.commentaire && (
                          <p className="text-sm text-orange mt-1 italic">💬 {calc.commentaire}</p>
                        )}
                      </div>
                      <button onClick={() => remove(poste.id)} className="btn-danger text-xs py-1 px-2">Supprimer</button>
                    </div>
                    {calc && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <th className="text-left px-3 py-2 rounded-l">Matériau</th>
                            <th className="text-right px-3 py-2">Qté</th>
                            <th className="text-right px-3 py-2">Unité</th>
                            <th className="text-right px-3 py-2">À acheter</th>
                            <th className="text-right px-3 py-2 rounded-r">Total €</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calc.lignes.map((l, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className={`px-3 py-2 ${l.est_dependant ? "pl-8 text-gray-500" : "font-medium"}`}>
                                {l.est_dependant ? "└ " : ""}{l.nom}
                                {l.est_dependant && (
                                  <span className="ml-1 text-xs text-gray-400">({l.type_dependance})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">{l.quantite.toFixed(3)}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{l.unite}</td>
                              <td className="px-3 py-2 text-right">
                                {l.nb_achat != null ? (
                                  <span className="inline-flex items-center gap-1 bg-orange/10 text-orange font-bold px-2 py-0.5 rounded-full text-xs">
                                    {l.nb_achat} {l.unite_achat ?? "u"}
                                  </span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">
                                {l.prix_unitaire ? `${l.total.toFixed(2)} €` : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}

              {totalPiece() > 0 && (
                <div className="flex justify-end">
                  <div className="card inline-flex items-center gap-3 py-3 px-5">
                    <span className="text-sm text-gray-500">Total estimé pièce :</span>
                    <span className="text-xl font-bold text-orange">{totalPiece().toFixed(2)} €</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal nouveau poste */}
      {showForm && piece && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="card w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-bleu mb-5">Nouveau poste de travaux</h2>

            {/* Autocomplete matériau */}
            <label className="label">Matériau principal *</label>
            <div ref={acRef} className="relative mb-4">
              <input
                className="input w-full"
                type="text"
                placeholder="Rechercher un matériau…"
                value={acSearch}
                autoComplete="off"
                onChange={(e) => {
                  setAcSearch(e.target.value);
                  setAcOpen(true);
                  if (!e.target.value) {
                    setSelectedMat(null);
                    setForm((f) => ({ ...f, materiau_principal_id: 0, corps_metier: "" }));
                  }
                }}
                onFocus={() => setAcOpen(true)}
              />
              {acOpen && (() => {
                const q = acSearch.toLowerCase();
                const filtered = materiaux.filter(
                  (m) =>
                    m.nom.toLowerCase().includes(q) ||
                    m.corps_metier.toLowerCase().includes(q)
                );
                return filtered.length > 0 ? (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto mt-1">
                    {filtered.map((m) => (
                      <li
                        key={m.id}
                        className="px-4 py-2.5 cursor-pointer hover:bg-bleu/5 flex items-baseline justify-between gap-3"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setAcSearch(m.nom);
                          setAcOpen(false);
                          handleSelectMateriau(m.id);
                        }}
                      >
                        <span className="font-medium text-sm">{m.nom}</span>
                        <span className="text-xs text-gray-400 shrink-0">{m.corps_metier} · {m.unite}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 px-4 py-3 text-sm text-gray-400">
                    Aucun matériau trouvé
                  </div>
                );
              })()}
            </div>

            {/* Bloc quantité — affiché seulement si matériau sélectionné */}
            {selectedMat && (
              <div className="bg-bleu/5 border border-bleu/15 rounded-xl p-4 mb-4">
                <p className="text-xs font-semibold text-bleu uppercase tracking-wide mb-3">
                  Quantité de référence
                </p>

                {/* Choix de la base de calcul */}
                {selectedMat.unite === "m²" ? (
                  <>
                    <p className="text-xs text-gray-500 mb-2">Surface à utiliser :</p>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {(["sol", "murs", "manuel"] as BaseRef[]).map((b) => (
                        <button
                          key={b}
                          onClick={() => handleChangeBase(b)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            baseRef === b
                              ? "bg-orange text-white"
                              : "bg-white border border-gray-300 text-gray-600 hover:border-orange"
                          }`}
                        >
                          {BASE_LABELS[b]}
                          {b !== "manuel" && (
                            <span className="ml-1 opacity-70">
                              ({computeQuantite(b, piece).toFixed(2)} m²)
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                ) : baseRef !== "manuel" ? (
                  <p className="text-xs text-gray-500 mb-2">
                    Calculé automatiquement depuis le{" "}
                    <span className="font-semibold text-bleu">{BASE_LABELS[baseRef].toLowerCase()}</span>{" "}
                    de la pièce.
                  </p>
                ) : null}

                {/* Champ quantité */}
                <div className="flex items-center gap-3">
                  <input
                    className={`input flex-1 ${baseRef !== "manuel" ? "bg-gray-50 text-bleu font-semibold" : ""}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.quantite_reference || ""}
                    readOnly={baseRef !== "manuel"}
                    onChange={(e) =>
                      baseRef === "manuel" &&
                      setForm({ ...form, quantite_reference: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <span className="text-sm text-gray-500 w-8 shrink-0">{selectedMat.unite}</span>
                </div>

                {baseRef !== "manuel" && (
                  <p className="text-xs text-gray-400 mt-2">
                    Valeur verrouillée sur la dimension de la pièce.{" "}
                    {selectedMat.unite === "m²" && (
                      <button
                        className="text-orange underline"
                        onClick={() => handleChangeBase("manuel")}
                      >
                        Saisir manuellement
                      </button>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Champ quantité fallback si aucun matériau sélectionné */}
            {!selectedMat && (
              <>
                <label className="label">Quantité de référence *</label>
                <input
                  className="input mb-4"
                  type="number" step="0.01" min="0"
                  value={form.quantite_reference || ""}
                  onChange={(e) => setForm({ ...form, quantite_reference: parseFloat(e.target.value) || 0 })}
                  placeholder="Sélectionnez d'abord un matériau"
                  disabled
                />
              </>
            )}

            {/* Commentaire */}
            <div className="mt-1">
              <label className="label">Commentaire (optionnel)</label>
              <textarea
                className="input h-20 resize-none"
                value={form.commentaire ?? ""}
                onChange={(e) => setForm({ ...form, commentaire: e.target.value || null })}
                placeholder="Ex : acheté en lot de 10, prévoir chute pour découpe angle…"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end mt-3">
              <button onClick={close} className="btn-ghost">Annuler</button>
              <button onClick={save} className="btn-primary">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
