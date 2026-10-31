from io import BytesIO
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo
from django.utils import timezone

from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, KeepTogether


def daily_report_pdf(report):
    stream = BytesIO()
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(stream, pagesize=A4, title='Rapport journalier', leftMargin=36, rightMargin=36)
    def paragraph(value, style='BodyText'):
        return Paragraph(escape(str(value or 'Non renseigné')).replace('\n', '<br/>'), styles[style])
    story = [paragraph('Rapport journalier', 'Title'), paragraph(report.project.name, 'Heading2'),
        paragraph(f"Date : {report.report_date:%d/%m/%Y} · Statut : {dict(draft='Brouillon', submitted='Soumis', validated='Validé').get(report.status, report.status)}"),
        paragraph(f'Météo : {report.weather}'), Spacer(1, 14)]
    for title, value in [('Travaux réalisés', report.work_done), ('Difficultés', report.difficulties), ('Dernière demande de correction', report.correction_reason)]:
        story.extend([paragraph(title, 'Heading2'), paragraph(value), Spacer(1, 12)])
    if report.validated_at:
        local_time = timezone.localtime(report.validated_at, ZoneInfo('Africa/Bujumbura'))
        story.append(paragraph(f'Validé le {local_time:%d/%m/%Y %H:%M} par {report.validated_by or "Utilisateur supprimé"} (Bujumbura)'))
    opened = []
    for photo in report.photo_set.filter(tenant_id=report.tenant_id, deleted_at__isnull=True).order_by('created_at'):
        try:
            source = photo.image.open('rb')
            opened.append(source)
            image = Image(source)
            image._restrictSize(500, 430)
            story.extend([Spacer(1, 12), KeepTogether([paragraph('Photo du chantier', 'Heading3'), image])])
        except (FileNotFoundError, OSError):
            story.append(paragraph('Photo indisponible'))
    try:
        doc.build(story)
    finally:
        for source in opened:
            source.close()
    response = HttpResponse(stream.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="rapport-{report.report_date}.pdf"'
    response['Cache-Control'] = 'private, no-store'
    return response
