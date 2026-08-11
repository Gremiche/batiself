"""Génération du PDF d'export d'un chantier via ReportLab."""

import io
from datetime import date

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from sqlmodel import Session, select

from models import Chantier, Piece, PosteTravaux, Materiau, Dependance

BLEU = colors.HexColor("#1a3a6b")
ORANGE = colors.HexColor("#F5821F")
GRIS_CLAIR = colors.HexColor("#F5F5F5")
GRIS = colors.HexColor("#CCCCCC")


def _styles():
    base = getSampleStyleSheet()
    return {
        "titre": ParagraphStyle("titre", fontSize=22, textColor=BLEU,
                                fontName="Helvetica-Bold", spaceAfter=2),
        "sous_titre": ParagraphStyle("sous_titre", fontSize=10, textColor=ORANGE,
                                     fontName="Helvetica-Bold", spaceAfter=6),
        "h2": ParagraphStyle("h2", fontSize=13, textColor=BLEU,
                              fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4),
        "h3": ParagraphStyle("h3", fontSize=11, textColor=ORANGE,
                              fontName="Helvetica-Bold", spaceBefore=6, spaceAfter=3),
        "normal": base["Normal"],
        "small": ParagraphStyle("small", fontSize=8, textColor=colors.grey),
    }


def _table_style(with_header: bool = True) -> TableStyle:
    cmds = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLAIR]),
        ("GRID", (0, 0), (-1, -1), 0.3, GRIS),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if with_header:
        cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), BLEU),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    return TableStyle(cmds)


def _calcul_poste(poste: PosteTravaux, session: Session):
    mat = session.get(Materiau, poste.materiau_principal_id)
    if not mat:
        return []
    qte = poste.quantite_reference * mat.ratio_consommation
    lignes = [(mat.nom, mat.corps_metier, mat.unite, round(qte, 3),
               mat.prix_unitaire, round(qte * (mat.prix_unitaire or 0), 2), False)]
    deps = session.exec(
        select(Dependance).where(Dependance.materiau_principal_id == poste.materiau_principal_id)
    ).all()
    for dep in deps:
        m = session.get(Materiau, dep.materiau_dependant_id)
        if not m:
            continue
        q = poste.quantite_reference * dep.ratio
        lignes.append((m.nom, m.corps_metier, m.unite, round(q, 3),
                       m.prix_unitaire, round(q * (m.prix_unitaire or 0), 2), True))
    return lignes


def generate_pdf(chantier_id: int, session: Session) -> bytes:
    chantier = session.get(Chantier, chantier_id)
    if not chantier:
        raise ValueError("Chantier introuvable")

    pieces = session.exec(select(Piece).where(Piece.chantier_id == chantier_id)).all()
    styles = _styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )

    story = []
    W = A4[0] - 36*mm

    # ── En-tête ──────────────────────────────────────────────────────────────
    story.append(Paragraph("batiself", styles["titre"]))
    story.append(Paragraph("GESTION DE CHANTIERS", styles["sous_titre"]))
    story.append(HRFlowable(width=W, color=ORANGE, thickness=2))
    story.append(Spacer(1, 4*mm))

    story.append(Paragraph(f"Chantier : {chantier.nom}", styles["h2"]))
    if chantier.description:
        story.append(Paragraph(chantier.description, styles["normal"]))
    story.append(Paragraph(
        f"Export du {date.today().strftime('%d/%m/%Y')} — {len(pieces)} pièce(s)",
        styles["small"],
    ))
    story.append(Spacer(1, 6*mm))

    # ── Récapitulatif global des pièces ──────────────────────────────────────
    story.append(Paragraph("Récapitulatif des pièces", styles["h2"]))
    recap_data = [["Pièce", "Type", "S. sol (m²)", "S. murs (m²)", "Volume (m³)"]]
    for p in pieces:
        perim = 2 * (p.longueur + p.largeur)
        s_sol = round(p.longueur * p.largeur, 2)
        s_murs = round(max(0, perim * p.hauteur - p.surface_ouvertures), 2)
        vol = round(p.longueur * p.largeur * p.hauteur, 2)
        recap_data.append([p.libelle, p.type_piece.value, s_sol, s_murs, vol])
    t = Table(recap_data, colWidths=[W*0.30, W*0.22, W*0.16, W*0.16, W*0.16])
    t.setStyle(_table_style())
    story.append(t)
    story.append(Spacer(1, 8*mm))

    # ── Détail par pièce ─────────────────────────────────────────────────────
    story.append(Paragraph("Matériaux par pièce", styles["h2"]))

    for piece in pieces:
        story.append(Paragraph(piece.libelle, styles["h3"]))
        postes = session.exec(
            select(PosteTravaux).where(PosteTravaux.piece_id == piece.id)
        ).all()

        if not postes:
            story.append(Paragraph("Aucun poste de travaux.", styles["small"]))
            story.append(Spacer(1, 3*mm))
            continue

        detail_data = [["Matériau", "Corps de métier", "Unité", "Quantité", "P.U. (€)", "Total (€)"]]
        for poste in postes:
            for nom, metier, unite, qte, pu, total, est_dep in _calcul_poste(poste, session):
                prefix = "  └ " if est_dep else ""
                detail_data.append([
                    prefix + nom, metier, unite,
                    f"{qte:,.3f}", f"{pu:.2f}" if pu else "—", f"{total:.2f}" if pu else "—",
                ])

        t = Table(detail_data, colWidths=[W*0.30, W*0.18, W*0.10, W*0.12, W*0.15, W*0.15])
        t.setStyle(_table_style())
        story.append(t)
        story.append(Spacer(1, 4*mm))

    # ── Liste consolidée ─────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Paragraph("Liste consolidée — tous les matériaux", styles["h2"]))

    consolidated: dict[int, dict] = {}
    for piece in pieces:
        postes = session.exec(
            select(PosteTravaux).where(PosteTravaux.piece_id == piece.id)
        ).all()
        for poste in postes:
            for nom, metier, unite, qte, pu, total, _ in _calcul_poste(poste, session):
                key = nom + unite
                if key not in consolidated:
                    consolidated[key] = {"nom": nom, "corps_metier": metier,
                                         "unite": unite, "quantite": 0.0,
                                         "prix_unitaire": pu, "total": 0.0}
                consolidated[key]["quantite"] += qte
                consolidated[key]["total"] += total

    consol_data = [["Matériau", "Corps de métier", "Unité", "Quantité totale", "P.U. (€)", "Total (€)"]]
    grand_total = 0.0
    for item in sorted(consolidated.values(), key=lambda x: x["corps_metier"]):
        pu = item["prix_unitaire"]
        consol_data.append([
            item["nom"], item["corps_metier"], item["unite"],
            f"{item['quantite']:,.3f}",
            f"{pu:.2f}" if pu else "—",
            f"{item['total']:.2f}" if pu else "—",
        ])
        grand_total += item["total"]

    t = Table(consol_data, colWidths=[W*0.28, W*0.18, W*0.10, W*0.16, W*0.14, W*0.14])
    t.setStyle(_table_style())
    story.append(t)

    story.append(Spacer(1, 4*mm))
    if grand_total > 0:
        total_data = [["", "", "", "", "TOTAL ESTIMÉ HT", f"{grand_total:,.2f} €"]]
        t_total = Table(total_data, colWidths=[W*0.28, W*0.18, W*0.10, W*0.16, W*0.14, W*0.14])
        t_total.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (4, 0), (5, 0), ORANGE),
            ("ALIGN", (4, 0), (5, 0), "RIGHT"),
            ("LINEABOVE", (4, 0), (5, 0), 1.5, ORANGE),
        ]))
        story.append(t_total)

    story.append(Spacer(1, 8*mm))
    story.append(HRFlowable(width=W, color=GRIS, thickness=0.5))
    story.append(Paragraph(
        f"Document généré par BatiSelf • {date.today().strftime('%d/%m/%Y')}",
        ParagraphStyle("footer", fontSize=7, textColor=colors.grey, alignment=TA_CENTER),
    ))

    doc.build(story)
    return buf.getvalue()
