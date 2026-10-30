"""Server-side A4 reports rendered with ReportLab Platypus."""
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

import reportlab
from reportlab.graphics.shapes import Drawing, Rect, String, PolyLine, Circle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND = colors.HexColor("#234f3d")
TINT = colors.HexColor("#edf4ef")
STATUS = {"todo": "À faire", "in_progress": "En cours", "done": "Terminée", "blocked": "Bloquée", "cancelled": "Annulée", "declared": "Déclaré", "analysis": "En analyse", "actions": "Actions en cours", "closed": "Clôturé"}


def build_report_pdf(context):
    font_dir = Path(reportlab.__file__).parent / "fonts"
    for name, filename in (("ReportVera", "Vera.ttf"), ("ReportVeraBold", "VeraBd.ttf")):
        if name not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont(name, str(font_dir / filename)))
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = "ReportVera"
        style.textColor = BRAND
    styles["BodyText"].fontSize = 9
    styles["BodyText"].leading = 14
    styles["Title"].fontName = "ReportVeraBold"
    styles["Title"].fontSize = 23
    styles["Heading2"].fontName = "ReportVeraBold"
    styles["Heading2"].keepWithNext = True
    styles["Heading3"].keepWithNext = True
    cell_style = ParagraphStyle("ReportCell", parent=styles["BodyText"], fontSize=8, leading=11, spaceBefore=0, spaceAfter=0)
    run = context["run"]
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm,
        topMargin=19 * mm, bottomMargin=20 * mm, title=run.template.name, author=run.tenant.name)
    story = []

    def text(value, style="BodyText"):
        return Paragraph(escape(str(value if value is not None else "—")).replace("\n", "<br/>"), styles[style])

    def money(value):
        return f"{value:,.2f}".replace(",", " ").replace(".", ",")

    def date_label(value):
        return value.strftime("%d/%m/%Y") if value else "—"

    def table(headers, rows, widths):
        data = [[Paragraph(escape(str(value)), cell_style) for value in headers]]
        data.extend([[Paragraph(escape(str(value if value is not None else "—")).replace("\n", "<br/>"), cell_style) for value in row] for row in rows])
        if len(data) == 1:
            data.append([Paragraph("Aucune donnée enregistrée.", cell_style)] + [""] * (len(headers) - 1))
        result = Table(data, colWidths=[doc.width * width for width in widths], repeatRows=1, hAlign="LEFT", splitInRow=1)
        result.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), TINT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), .4, colors.HexColor("#d6e0d9")),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        return result

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(BRAND)
        canvas.line(doc.leftMargin, A4[1] - 12 * mm, A4[0] - doc.rightMargin, A4[1] - 12 * mm)
        canvas.setFont("ReportVera", 7)
        canvas.drawString(doc.leftMargin, 12 * mm, str(run.tenant.name)[:65])
        canvas.drawRightString(A4[0] - doc.rightMargin, 12 * mm, f"Rapport · Page {document.page}")
        canvas.restoreState()

    story.extend([
        text(run.tenant.name, "Heading2"), text(run.template.name, "Title"),
        text(f"Situation au {context['generated_at'].strftime('%d/%m/%Y à %H:%M')} (Bujumbura)"),
        text(f"Référence : {run.pk}"),
        text(f"Périmètre : {run.parameters.get('project') or 'Tous les chantiers'}"),
        text(f"Période : {run.parameters.get('start_date', 'Depuis le début')} — {run.parameters.get('end_date', 'À ce jour')}"),
        Spacer(1, 7 * mm), text("Synthèse", "Heading2"),
        table(["Avancement", "Tâches terminées", "Incidents ouverts"], [[f"{context['progress']:.1f} %", f"{context['completed_count']} / {context['task_count']}", context["open_incident_count"]]], [.34, .33, .33]),
        Spacer(1, 3 * mm),
        text("Dépenses validées : " + (" · ".join(f"{money(amount)} {currency}" for currency, amount in context["spending"]) or "Aucune dépense")),
        text("La période filtre les dépenses et les incidents. Le planning retient les tâches qui chevauchent la période et les dates non renseignées. Le budget prévu est l’enveloppe totale ; le solde est cette enveloppe moins les dépenses TTC validées ou payées de la période. Aucune conversion entre devises. L’avancement est la moyenne simple des tâches."),
    ])
    for index, row in enumerate(context["rows"]):
        if index:
            story.append(PageBreak())
        project = row["project"]
        story.extend([Spacer(1, 6 * mm), text(row["name"], "Heading2"), text(row["code"]),
            text(f"Client : {project.client_name or 'Non renseigné'} · Statut : {project.get_status_display()}"),
            text(f"Adresse : {project.address or 'Non renseignée'}"),
            text(f"Planning prévu : {date_label(project.planned_start_date)} — {date_label(project.planned_end_date)}"),
            text("1. Avancement et planning", "Heading3"),
            text(f"{row['tasks']['count']} tâches · {row['completed']} terminées · {row['overdue']} en retard"),
        ])
        progress = float(row["tasks"]["progress"] or 0)
        chart = Drawing(doc.width, 32)
        chart.add(Rect(0, 8, doc.width, 10, fillColor=TINT, strokeColor=None))
        chart.add(Rect(0, 8, doc.width * max(0, min(progress, 100)) / 100, 10, fillColor=BRAND, strokeColor=None))
        chart.add(String(0, 23, f"Avancement moyen : {progress:.1f} %", fontName="ReportVera", fontSize=8, fillColor=BRAND))
        story.append(chart)
        story.append(table(["Tâche", "Statut", "Début", "Fin", "%"], [
            [task.name + ("\nEn retard" if task.is_overdue else ""), STATUS.get(task.status, task.status), date_label(task.planned_start_date), date_label(task.planned_end_date), task.progress_percent]
            for task in row["task_details"]], [.34, .20, .17, .17, .12]))
        story.extend([text("2. Situation financière", "Heading3"), table(["Devise", "Budget prévu", "Dépenses TTC", "Solde sur période"], [
            [item["currency"], money(item["planned"]), money(item["spent"]), money(item["remaining"])] for item in row["finances"]], [.15, .28, .28, .29])])
        expense_details = row.get("expense_details", [])
        story.extend([text("Détail des dépenses validées et payées", "Heading3"), table(
            ["Date", "Fournisseur / budget", "Lignes", "HT", "Taxe", "TTC / devise"], [
                [date_label(item.date), f"{item.supplier_name}\n{item.budget_line.label}",
                 "\n".join(f"{line['label']} : {line['quantity']} × {line['unit_price']}" for line in item.details) or "Sans détail",
                 money(item.amount_excluding_tax), money(item.tax_amount), f"{money(item.amount_including_tax)} {item.currency}"]
                for item in expense_details], [.12, .23, .23, .12, .12, .18])])
        for currency in sorted({item.currency for item in expense_details}):
            monthly = {}
            for item in expense_details:
                if item.currency == currency:
                    month = item.date.strftime("%Y-%m")
                    monthly[month] = monthly.get(month, 0) + item.amount_including_tax
            points = sorted(monthly.items())
            maximum = max(float(amount) for _, amount in points) or 1
            curve = Drawing(doc.width, 125)
            coordinates = []
            for index, (month, amount) in enumerate(points):
                x = 15 + index * (doc.width - 45) / max(len(points) - 1, 1)
                y = 25 + float(amount) / maximum * 70
                coordinates.extend([x, y])
                curve.add(Circle(x, y, 3, fillColor=BRAND, strokeColor=None))
                curve.add(String(x, 10, month, fontName="ReportVera", fontSize=7))
            if len(points) > 1:
                curve.add(PolyLine(coordinates, strokeColor=BRAND, strokeWidth=2))
            story.extend([text(f"Évolution mensuelle des dépenses TTC — {currency}", "Heading3"), curve])
        story.extend([text("3. Qualité et sécurité", "Heading3"), table(["Incident", "Date", "Statut", "Observations"], [
            [item.title, date_label(item.occurred_at.astimezone(ZoneInfo("Africa/Bujumbura"))), STATUS.get(item.status, item.status), item.description or "—"] for item in row["incident_details"]], [.27, .16, .18, .39])])
        story.extend([text("Actions correctives", "Heading3"), table(["Action", "Incident", "Échéance", "État"], [
            [item.title, item.incident.title, date_label(item.due_date), "Terminée" if item.completed_at else "À réaliser"] for item in row["actions"]], [.30, .30, .20, .20])])
    if not context["rows"]:
        story.append(text("Aucun chantier ne correspond au périmètre sélectionné."))
    story.extend([text("Observations et décisions", "Heading2"), text(run.parameters.get("observations") or "Aucune observation complémentaire.")])
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
