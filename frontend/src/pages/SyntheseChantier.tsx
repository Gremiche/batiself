import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, LigneSynthese, Synthese } from "../api/client";

export default function SyntheseChantier() {
  const { id } = useParams<{ id: string }>();
  const chantierId = Number(id);
  const navigate = useNavigate();

  const [synthese, setSynthese] = useState<Synthese | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSynthese(chantierId)
      .then(setSynthese)
      .finally(() => setLoading(false));
  }, [chantierId]);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center text-gray-400 py-24">
        Chargement de la synthèse…
      </div>
    );
  }

  if (!synthese) return null;

  const byMetier = synthese.lignes.reduce<Record<string, LigneSynthese[]>>((acc, l) => {
    (acc[l.corps_metier] ??= []).push(l);
    return acc;
  }, {});

  const f = (n: number) => n.toFixed(2);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="print:hidden flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(`/chantier/${chantierId}`)}
          className="text-sm text-gray-500 hover:text-bleu flex items-center gap-1"
        >
          ← Retour au chantier
        </button>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2">
          🖨️ Imprimer
        </button>
      </div>

      <div className="flex items-baseline gap-4 mb-8">
        <h1 className="text-3xl font-bold text-bleu">Synthèse — {synthese.nom}</h1>
        <span className="text-gray-400 text-sm">{synthese.lignes.length} matériau(x)</span>
      </div>

      {synthese.lignes.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Aucun matériau dans ce chantier</p>
          <p className="text-sm mt-1">Ajoutez des postes dans vos pièces pour voir la synthèse.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byMetier).map(([metier, lignes]) => (
            <div key={metier}>
              <h2 className="text-sm font-bold text-orange uppercase tracking-widest mb-2">
                {metier}
              </h2>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bleu text-white text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Matériau</th>
                      <th className="text-right px-4 py-3">Qté totale</th>
                      <th className="text-left px-4 py-3">Unité</th>
                      <th className="text-right px-4 py-3">À acheter</th>
                      <th className="text-right px-4 py-3">Prix HT</th>
                      <th className="text-right px-4 py-3">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((l, i) => (
                      <tr key={l.materiau_id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-2.5 font-medium">{l.nom}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{f(l.quantite_totale)}</td>
                        <td className="px-4 py-2.5 text-gray-500">{l.unite}</td>
                        <td className="px-4 py-2.5 text-right">
                          {l.nb_achat != null ? (
                            <span className="bg-orange/10 text-orange font-bold px-2 py-0.5 rounded-full text-xs">
                              {l.nb_achat} {l.unite_achat ?? "u"}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                          {l.prix_unitaire != null ? `${f(l.prix_unitaire)} €` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                          {l.total > 0 ? `${f(l.total)} €` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="card bg-bleu text-white flex justify-between items-center px-6 py-4">
            <span className="font-bold text-lg uppercase tracking-wide">Total HT</span>
            <span className="font-bold text-2xl tabular-nums">
              {f(synthese.total_ht)} €
            </span>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { background: white; }
          .card { box-shadow: none; border: 1px solid #e5e7eb; }
        }
      `}</style>
    </div>
  );
}
