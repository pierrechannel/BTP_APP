from datetime import date
from decimal import Decimal

import pytest

from apps.budget.models import Budget, BudgetLine, Expense, Invoice
from apps.projects.models import Project
from tests.test_regressions import setup  # noqa: F401

pytestmark = pytest.mark.django_db
ROOT = '/api/v1/budget/'


def records(setup, amount='100'):
    tenant, _, project, _, client = setup
    budget = Budget.objects.create(tenant=tenant, project=project)
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, amount=amount, label='Travaux')
    expense = Expense.objects.create(tenant=tenant, budget_line=line, date=date(2026, 10, 31), amount_excluding_tax=80, amount_including_tax=80, currency='BIF')
    return tenant, project, client, budget, line, expense


def test_budget_list_exposes_sum_of_posts_excluding_deleted(setup):
    from django.utils import timezone
    tenant, _, client, budget, _, _ = records(setup)
    BudgetLine.objects.create(tenant=tenant, budget=budget, amount='25.50', label='Transport')
    BudgetLine.objects.create(tenant=tenant, budget=budget, amount=999, label='Deleted', deleted_at=timezone.now())
    response = client.get(ROOT + 'budgets/')
    assert response.status_code == 200, response.data
    assert response.data['results'][0]['total_amount'] == '125.50'
    summary = client.get(ROOT + f'budgets/{budget.pk}/summary/').data
    assert summary['planned'] == Decimal(response.data['results'][0]['total_amount'])
    project = Project.objects.create(tenant=tenant, code='EMPTY-TOTAL', name='Empty')
    empty = Budget.objects.create(tenant=tenant, project=project)
    assert client.get(ROOT + f'budgets/{empty.pk}/').data['total_amount'] == '0.00'
    assert client.get(ROOT + f'budgets/{empty.pk}/').data['total_expenses_amount'] == '0.00'


def test_budget_list_expense_total_matches_summary_without_inflating_budget(setup):
    from django.utils import timezone
    tenant, _, client, budget, line, _ = records(setup)
    second = BudgetLine.objects.create(tenant=tenant, budget=budget, amount=200, label='Transport')
    for status, amount, target in [('validated', 20, line), ('paid', 30, line), ('validated', 15, second), ('submitted', 50, second), ('rejected', 100, second)]:
        Expense.objects.create(tenant=tenant, budget_line=target, date=date(2026, 10, 31), currency='BIF', amount_excluding_tax=amount, amount_including_tax=amount, status=status)
    Expense.objects.create(tenant=tenant, budget_line=line, date=date(2026, 10, 31), currency='BIF', amount_excluding_tax=999, amount_including_tax=999, status='validated', deleted_at=timezone.now())
    response = client.get(ROOT + 'budgets/')
    assert response.status_code == 200, response.data
    row = response.data['results'][0]
    assert row['total_amount'] == '300.00'
    assert row['total_expenses_amount'] == '65.00'
    assert client.get(ROOT + f'budgets/{budget.pk}/summary/').data['spent'] == Decimal(row['total_expenses_amount'])


def test_expense_lifecycle_engagements_and_payment(setup):
    _, _, client, budget, _, expense = records(setup)
    url = ROOT + f'expenses/{expense.pk}/'
    assert client.post(url + 'pay/').status_code == 400
    assert client.post(url + 'submit/').status_code == 200
    summary = client.get(ROOT + f'budgets/{budget.pk}/summary/').data
    assert summary['committed'] == 80 and summary['available'] == 20 and summary['spent'] == 0
    assert client.patch(url, {'supplier_name': 'Changed'}).status_code == 400
    assert client.post(url + 'reject/').status_code == 200
    assert client.post(url + 'validate/').status_code == 400
    assert client.post(url + 'reopen/').status_code == 200
    assert client.post(url + 'validate/').status_code == 200
    assert client.post(url + 'pay/').status_code == 200
    summary = client.get(ROOT + f'budgets/{budget.pk}/summary/').data
    assert summary['paid'] == 80 and summary['spent'] == 80 and summary['committed'] == 0


def test_expense_overrun_needs_explicit_confirmation(setup):
    _, _, client, _, _, expense = records(setup, amount='50')
    url = ROOT + f'expenses/{expense.pk}/validate/'
    response = client.post(url, {}, format='json')
    assert response.status_code == 400 and response.data['code'] == 'budget_overrun'
    expense.refresh_from_db()
    assert expense.status == 'draft'
    assert client.post(url, {'allow_overrun': 'true'}, format='json').status_code == 400
    assert client.post(url, {'allow_overrun': True}, format='json').status_code == 200


def test_budget_and_line_cannot_move_existing_costs(setup):
    tenant, _, client, budget, line, _ = records(setup)
    project = Project.objects.create(tenant=tenant, code='OTHER', name='Other')
    other = Budget.objects.create(tenant=tenant, project=project)
    assert client.patch(ROOT + f'budgets/{budget.pk}/', {'project': str(project.pk)}).status_code == 400
    assert client.patch(ROOT + f'budget-lines/{line.pk}/', {'budget': str(other.pk)}).status_code == 400


@pytest.mark.parametrize('pay_invoice', [True, False])
def test_linked_invoice_payment_is_synchronized(setup, pay_invoice):
    tenant, project, client, _, _, expense = records(setup)
    invoice = Invoice.objects.create(tenant=tenant, project=project, invoice_number='INV-LINK', issue_date=date(2026, 10, 31), amount_excluding_tax=80, amount_including_tax=80, currency='BIF')
    expense_url = ROOT + f'expenses/{expense.pk}/'
    invoice_url = ROOT + f'invoices/{invoice.pk}/'
    assert client.patch(expense_url, {'invoice': str(invoice.pk)}).status_code == 200
    assert client.patch(invoice_url, {'amount_excluding_tax': '81'}).status_code == 400
    assert client.post(expense_url + 'validate/').status_code == 200
    assert client.post(expense_url + 'pay/').status_code == 400
    assert client.post(invoice_url + 'validate/').status_code == 200
    assert client.post((invoice_url if pay_invoice else expense_url) + 'pay/').status_code == 200
    expense.refresh_from_db(); invoice.refresh_from_db()
    assert expense.status == invoice.status == 'paid'


def test_expense_rounds_sum_once_half_up(setup):
    _, _, client, _, line, _ = records(setup)
    response = client.post(ROOT + 'expenses/', {'budget_line': str(line.pk), 'date': '2026-10-31', 'currency': 'BIF',
        'details': [{'label': 'A', 'quantity': '0.001', 'unit_price': '2.50'}, {'label': 'B', 'quantity': '0.001', 'unit_price': '2.50'}]}, format='json')
    assert response.status_code == 201, response.data
    assert Decimal(response.data['amount_excluding_tax']) == Decimal('0.01')
