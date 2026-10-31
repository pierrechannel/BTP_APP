from datetime import date
from io import BytesIO
from decimal import Decimal

import pytest
from pypdf import PdfReader

from apps.accounts.models import Tenant
from apps.budget.models import Budget, BudgetLine, Expense
from apps.projects.models import Project
from apps.resources.models import Material, PurchaseOrder, PurchaseOrderLine, Supplier
from apps.workforce.models import Worker, TimeEntry
from apps.reports.models import ReportTemplate, ReportRun
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db


def pdf_text(response):
    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
    return '\n'.join(page.extract_text() for page in PdfReader(BytesIO(response.content)).pages)


def test_worker_form_requires_selected_rate_and_saves_identity(setup):
    *_, client = setup
    endpoint = '/api/v1/workforce/workers/'
    payload = dict(first_name='Alice', last_name='Test', payment_basis='daily',
                   address='Bujumbura', identity_number='ID123')
    assert client.post(endpoint, payload).status_code == 400
    response = client.post(endpoint, {**payload, 'daily_rate': '15000'})
    assert response.status_code == 201
    assert response.data['identity_number'] == 'ID123'
    assert response.data['daily_rate'] == '15000.00'
    assert client.patch(endpoint + str(response.data['id']) + '/', {'payment_basis': 'monthly'}).status_code == 400


def test_expense_details_calculate_totals_and_validate(setup):
    tenant, _, project, _, client = setup
    budget = Budget.objects.create(tenant=tenant, project=project)
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, label='Travaux', amount=1000)
    payload = dict(budget_line=str(line.pk), date='2026-10-30', currency='BIF', tax_amount='5',
        amount_excluding_tax='999', details=[{'label': 'Ciment', 'quantity': '2.5', 'unit_price': '10'}])
    response = client.post('/api/v1/budget/expenses/', payload, format='json')
    assert response.status_code == 201, response.data
    expense = Expense.objects.get(pk=response.data['id'])
    assert expense.amount_excluding_tax == Decimal('25')
    assert expense.amount_including_tax == Decimal('30')
    payload['details'][0]['quantity'] = '-1'
    assert client.post('/api/v1/budget/expenses/', payload, format='json').status_code == 400


def test_attendance_pdf_period_tenant_and_permission(setup):
    tenant, _, project, _, client = setup
    worker = Worker.objects.create(tenant=tenant, first_name='Alice', last_name='Present')
    TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 10, 30), normal_hours=8)
    TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 9, 1), normal_hours=4)
    other = Tenant.objects.create(name='Other', slug='other-export')
    foreign = Worker.objects.create(tenant=other, first_name='Secret', last_name='Hidden')
    endpoint = '/api/v1/workforce/workers/'
    text = pdf_text(client.get(endpoint + 'attendance-pdf/', {'start_date': '2026-10-01'}))
    assert 'Alice Present' in text and '2026-10-30' in text and '8.00' in text
    assert '2026-09-01' not in text and 'Secret' not in text
    assert client.get(endpoint + str(foreign.pk) + '/attendance-pdf/').status_code == 404
    assert client.get(endpoint + 'attendance-pdf/', {'start_date': 'invalid'}).status_code == 400
    user, _ = member(tenant, 'reader', {'workforce': ['read']})
    client.force_authenticate(user)
    assert client.get(endpoint + str(worker.pk) + '/attendance-pdf/').status_code == 200
    assert client.post(endpoint + str(worker.pk) + '/archive/').status_code == 404


def test_weekly_planning_and_order_pdf(setup):
    tenant, _, project, (task, _, _), client = setup
    task.name = 'Semaine cible'
    task.planned_start_date = date(2026, 10, 26)
    task.planned_end_date = date(2026, 10, 30)
    task.save()
    text = pdf_text(client.get('/api/v1/planning/tasks/weekly-pdf/', {'start_date': '2026-10-30'}))
    assert '2026-10-26' in text and '2026-11-01' in text and 'Semaine cible' in text
    supplier = Supplier.objects.create(tenant=tenant, name='Fournisseur test')
    order = PurchaseOrder.objects.create(tenant=tenant, project=project, supplier=supplier)
    material = Material.objects.create(tenant=tenant, name='Ciment', reference='CIM', unit='sac')
    PurchaseOrderLine.objects.create(tenant=tenant, purchase_order=order, material=material, quantity=3, unit_price=10)
    text = pdf_text(client.get(f'/api/v1/resources/purchase-orders/{order.pk}/pdf/'))
    assert 'Ciment' in text and '30.00 BIF' in text and 'Fournisseur test' in text


def test_report_pdf_includes_expense_lines_and_monthly_curve(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.REPORTS_ASYNC = False
    tenant, _, project, _, client = setup
    budget = Budget.objects.create(tenant=tenant, project=project)
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, label='Travaux', amount=1000)
    for month in (9, 10):
        Expense.objects.create(tenant=tenant, budget_line=line, date=date(2026, month, 1),
            amount_excluding_tax=20, amount_including_tax=20, currency='BIF', status='validated',
            details=[{'label': 'Article export', 'quantity': '2', 'unit_price': '10'}])
    template = ReportTemplate.objects.create(tenant=tenant, name='Synthese')
    response = client.post(f'/api/v1/reports/templates/{template.pk}/run/', {'parameters': {}}, format='json')
    assert response.status_code == 200
    run = ReportRun.objects.get(pk=response.data['id'])
    assert run.status == 'completed'
    with run.result_file.open('rb') as document:
        text = '\n'.join(page.extract_text() for page in PdfReader(document).pages)
    assert 'Article export' in text and '2026-09' in text and '2026-10' in text


@pytest.mark.parametrize('kind', ['worker', 'project'])
def test_archiving_is_removed_and_legacy_records_stay_accessible(setup, kind):
    from django.utils import timezone
    tenant, _, project, _, client = setup
    obj = Worker.objects.create(tenant=tenant, first_name='Alice', last_name='Legacy') if kind == 'worker' else project
    obj.archived_at = timezone.now()
    obj.save()
    endpoint = '/api/v1/workforce/workers/' if kind == 'worker' else '/api/v1/projects/'
    assert client.post(f'{endpoint}{obj.pk}/archive/').status_code == 404
    assert client.post(f'{endpoint}{obj.pk}/restore/').status_code == 404
    response = client.get(f'{endpoint}{obj.pk}/')
    assert response.status_code == 200
    assert 'archived_at' not in response.data
    assert any(str(row['id']) == str(obj.pk) for row in client.get(endpoint).data['results'])
    assert any(str(row['id']) == str(obj.pk) for row in client.get(endpoint, {'archived': 'true'}).data['results'])
    obj.refresh_from_db()
    assert obj.deleted_at is None
