const BASE = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Erreur réseau");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Chantiers
  getChantiers: () => req<Chantier[]>("/chantiers/"),
  getChantier: (id: number) => req<Chantier>(`/chantiers/${id}`),
  createChantier: (data: ChantierPayload) =>
    req<Chantier>("/chantiers/", { method: "POST", body: JSON.stringify(data) }),
  updateChantier: (id: number, data: ChantierPayload) =>
    req<Chantier>(`/chantiers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteChantier: (id: number) =>
    req<void>(`/chantiers/${id}`, { method: "DELETE" }),

  // Pièces
  getPieces: (chantierId: number) => req<Piece[]>(`/pieces/chantier/${chantierId}`),
  getPiece: (id: number) => req<Piece>(`/pieces/${id}`),
  createPiece: (data: PiecePayload) =>
    req<Piece>("/pieces/", { method: "POST", body: JSON.stringify(data) }),
  updatePiece: (id: number, data: PiecePayload) =>
    req<Piece>(`/pieces/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePiece: (id: number) =>
    req<void>(`/pieces/${id}`, { method: "DELETE" }),
  getSuggestions: (pieceId: number) =>
    req<Materiau[]>(`/pieces/${pieceId}/suggestions`),

  // Matériaux
  getMateriaux: () => req<Materiau[]>("/materiaux/"),
  createMateriau: (data: MateriauPayload) =>
    req<Materiau>("/materiaux/", { method: "POST", body: JSON.stringify(data) }),
  updateMateriau: (id: number, data: MateriauPayload) =>
    req<Materiau>(`/materiaux/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMateriau: (id: number) =>
    req<void>(`/materiaux/${id}`, { method: "DELETE" }),

  // Dépendances & Incompatibilités
  getDependances: () => req<Dependance[]>("/dependances"),
  createDependance: (data: DependancePayload) =>
    req<Dependance>("/dependances", { method: "POST", body: JSON.stringify(data) }),
  deleteDependance: (id: number) =>
    req<void>(`/dependances/${id}`, { method: "DELETE" }),
  getIncompatibilites: () => req<Incompatibilite[]>("/incompatibilites"),
  createIncompatibilite: (data: IncompatibilitePayload) =>
    req<Incompatibilite>("/incompatibilites", { method: "POST", body: JSON.stringify(data) }),
  deleteIncompatibilite: (id: number) =>
    req<void>(`/incompatibilites/${id}`, { method: "DELETE" }),

  // Postes
  getPostes: (pieceId: number) => req<Poste[]>(`/postes/piece/${pieceId}`),
  createPoste: (data: PostePayload) =>
    req<Poste>("/postes/", { method: "POST", body: JSON.stringify(data) }),
  deletePoste: (id: number) =>
    req<void>(`/postes/${id}`, { method: "DELETE" }),
  calculPoste: (posteId: number) => req<CalcResult>(`/postes/calcul/${posteId}`),
  checkIncompatibilites: (pieceId: number) =>
    req<{ alertes: Alerte[] }>(`/postes/incompatibilites/piece/${pieceId}`),

  // Import Obat
  importObat: async (file: File): Promise<{ message: string; crees: number; mis_a_jour: number }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(BASE + "/import/obat", { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Erreur import");
    }
    return res.json();
  },

  // PDF export
  exportPdf: (chantierId: number) =>
    window.open(BASE + `/export/pdf/${chantierId}`, "_blank"),
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Chantier {
  id: number;
  nom: string;
  description: string;
  nb_pieces: number;
}
export interface ChantierPayload { nom: string; description: string }

export interface Piece {
  id: number;
  chantier_id: number;
  libelle: string;
  longueur: number;
  largeur: number;
  hauteur: number;
  type_piece: string;
  surface_ouvertures: number;
  surface_sol: number;
  surface_murs: number;
  volume: number;
}
export interface PiecePayload {
  chantier_id: number;
  libelle: string;
  longueur: number;
  largeur: number;
  hauteur: number;
  type_piece: string;
  surface_ouvertures: number;
}

export interface Materiau {
  id: number;
  nom: string;
  corps_metier: string;
  unite: string;
  ratio_consommation: number;
  prix_unitaire: number | null;
  fournisseur: string | null;
  notes: string | null;
  reference_obat: string | null;
}
export interface MateriauPayload {
  nom: string;
  corps_metier: string;
  unite: string;
  ratio_consommation: number;
  prix_unitaire: number | null;
  fournisseur: string | null;
  notes: string | null;
  reference_obat: string | null;
}

export interface Dependance {
  id: number;
  materiau_principal_id: number;
  materiau_dependant_id: number;
  ratio: number;
  type_dependance: string;
  condition: string | null;
}
export interface DependancePayload {
  materiau_principal_id: number;
  materiau_dependant_id: number;
  ratio: number;
  type_dependance: string;
  condition: string | null;
}

export interface Incompatibilite {
  id: number;
  materiau_a_id: number;
  materiau_b_id: number;
  raison: string;
  severite: string;
}
export interface IncompatibilitePayload {
  materiau_a_id: number;
  materiau_b_id: number;
  raison: string;
  severite: string;
}

export interface Poste {
  id: number;
  piece_id: number;
  corps_metier: string;
  materiau_principal_id: number;
  quantite_reference: number;
}
export interface PostePayload {
  piece_id: number;
  corps_metier: string;
  materiau_principal_id: number;
  quantite_reference: number;
}

export interface LigneCalc {
  materiau_id: number;
  nom: string;
  unite: string;
  quantite: number;
  prix_unitaire: number | null;
  total: number;
  est_dependant: boolean;
  type_dependance?: string;
}
export interface CalcResult { poste_id: number; lignes: LigneCalc[] }
export interface Alerte {
  materiau_a: string;
  materiau_b: string;
  raison: string;
  severite: string;
}
