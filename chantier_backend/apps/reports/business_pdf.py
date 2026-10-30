"""Authenticated business exports; callers supply tenant-scoped querysets."""
from datetime import timedelta
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import serializers
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


def period(request, weekly=False):
    field = serializers.DateField()
    start = field.run_validation(request.query_params['start_date']) if request.query_params.get('start_date') else None
    end = field.run_validation(request.query_params['end_date']) if request.query_params.get('end_date') else None
    if weekly:
        start = start or timezone.localdate()
        start -= timedelta(days=start.weekday())
        end = start + timedelta(days=6)
    if start and end and end < start:
        raise serializers.ValidationError({'end_date': 'La fin doit suivre le début.'})
    return start, end


def pdf_response(title, tenant, sections, filename):
    stream = BytesIO()
    doc = SimpleDocTemplate(stream, pagesize=landscape(A4), title=title, author=tenant.name,
                            leftMargin=28, rightMargin=28, topMargin=30, bottomMargin=32)
    styles = getSampleStyleSheet()
    def para(value, style='BodyText'):
        return Paragraph(escape(str(value if value is not None else '—')), styles[style])
    story = [para(tenant.name, 'Heading2'), para(title, 'Title')]
    for index, (heading, description, headers, rows, summary) in enumerate(sections):
        if index:
            story.append(PageBreak())
        story.extend([para(heading, 'Heading2'), para(description), Spacer(1, 12)])
        data = [[para(item) for item in headers]]
        data += [[para(item) for item in row] for row in rows]
        if len(data) == 1:
            data.append([para('Aucune donnée sur cette période.')] + [''] * (len(headers)-1))
        table = Table(data, colWidths=[doc.width / len(headers)] * len(headers), repeatRows=1)
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf4ef')),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LINEBELOW', (0, 0), (-1, -1), .4, colors.lightgrey),
            ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
        story.extend([table, Spacer(1, 12), para(summary)])
    def footer(canvas, document):
        canvas.setFont('Helvetica', 8)
        canvas.drawString(28, 18, f'{timezone.localdate():%d/%m/%Y} | Page {document.page}')
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    response = HttpResponse(stream.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


def current_tenant(request):
    from apps.accounts.models import Tenant
    return Tenant.objects.get(pk=request.tenant_id)


def attendance_pdf(request, workers):
    from apps.workforce.models import TimeEntry
    start, end = period(request)
    sections = []
    for worker in workers:
        entries = TimeEntry.objects.filter(tenant_id=request.tenant_id, worker=worker,
            deleted_at__isnull=True, project__deleted_at__isnull=True).select_related('project').order_by('work_date', 'project__name')
        if start:
            entries = entries.filter(work_date__gte=start)
        if end:
            entries = entries.filter(work_date__lte=end)
        project = request.query_params.get('project')
        if project:
            project = serializers.UUIDField().run_validation(project)
            entries = entries.filter(project_id=project)
        entries = list(entries)
        normal = sum((entry.normal_hours for entry in entries), Decimal('0'))
        overtime = sum((entry.overtime_hours for entry in entries), Decimal('0'))
        days = len({entry.work_date for entry in entries if entry.normal_hours + entry.overtime_hours > 0})
        sections.append((f'{worker.first_name} {worker.last_name}',
            f'Période : {start or "Origine"} au {end or "Ce jour"} | {worker.job_title} | Mode : {worker.get_payment_basis_display()}',
            ['Date', 'Chantier', 'Heures normales', 'Heures supplémentaires', 'Validation'],
            [[entry.work_date, entry.project.name, entry.normal_hours, entry.overtime_hours,
              'Validé' if entry.is_validated else 'Brouillon'] for entry in entries],
            f'{days} jours pointés | {normal} h normales | {overtime} h supplémentaires. Les jours sans pointage ne constituent pas une absence constatée.'))
    return pdf_response('Fiches de présence', current_tenant(request), sections or [('Collaborateurs', '', ['Présences'], [], '')], 'presences.pdf')


def weekly_pdf(request, tasks):
    start, end = period(request, weekly=True)
    tasks = tasks.filter(Q(planned_start_date__lte=end) | Q(planned_start_date__isnull=True)).filter(
        Q(planned_end_date__gte=start) | Q(planned_end_date__isnull=True)).order_by('project__name', 'planned_start_date')
    return pdf_response('Planning de la semaine', current_tenant(request), [(f'Du {start} au {end}',
        'Tâches chevauchant la semaine, y compris les dates non renseignées.',
        ['Chantier', 'Tâche', 'Début', 'Fin', 'Statut', 'Avancement'],
        [[task.project.name, task.name, task.planned_start_date, task.planned_end_date, task.status,
          f'{task.progress_percent} %'] for task in tasks], 'Dates et avancement prévus au moment de la génération.')], 'planning-semaine.pdf')


def purchase_order_pdf(request, order):
    lines = list(order.lines.filter(tenant_id=request.tenant_id, deleted_at__isnull=True,
        material__deleted_at__isnull=True).select_related('material'))
    totals = {}
    for line in lines:
        totals[line.currency] = totals.get(line.currency, Decimal('0')) + line.quantity * line.unit_price
    return pdf_response('Bon de commande', current_tenant(request), [(order.order_number,
        f'Chantier : {order.project.name} | Fournisseur : {order.supplier.name} | Date : {order.ordered_at or "—"} | Statut : {order.status}',
        ['Article', 'Unité', 'Quantité', 'Prix unitaire', 'Montant', 'Devise'],
        [[line.material.name, line.material.unit, line.quantity, line.unit_price,
          f'{line.quantity * line.unit_price:.2f}', line.currency] for line in lines],
        'Total : ' + (' | '.join(f'{amount:.2f} {currency}' for currency, amount in sorted(totals.items())) or '0') +
        ' — Taxes non calculées. Signature du demandeur : __________________ Signature du fournisseur : __________________')], 'bon-commande.pdf')
