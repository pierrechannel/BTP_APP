import json
from datetime import date

import pytest
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import Tenant
from apps.budget.models import Budget, BudgetLine, Expense, ExpenseReceipt
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db
ROOT = '/api/v1/budget/expenses/'


@pytest.fixture(autouse=True)
def private_files(tmp_path, monkeypatch):
    monkeypatch.setattr(ExpenseReceipt._meta.get_field('file'), 'storage', FileSystemStorage(location=tmp_path))


def pdf(name='recu.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 receipt', content_type='application/pdf')


def test_expense_options_supports_reverse_receipts_relation(setup):
    response = setup[-1].options(ROOT)
    assert response.status_code == 200, response.data
    assert response.data['actions']['POST']['receipts']['read_only'] is True
    assert response.data['actions']['POST']['receipt_files']['child']['type'] == 'file upload'
    assert response.data['actions']['POST']['tax_amount']['default'] == 0
    created = create(setup)
    assert created.status_code == 201, created.data
    response = setup[-1].options(ROOT + str(created.data['id']) + '/')
    assert response.status_code == 200, response.data
    assert response.data['actions']['PUT']['receipts']['read_only'] is True


def line_for(setup):
    tenant, _, project, _, _ = setup
    budget, _ = Budget.objects.get_or_create(tenant=tenant, project=project)
    return BudgetLine.objects.create(tenant=tenant, budget=budget, label='Travaux', amount=1000)


def create(setup, **extra):
    return setup[-1].post(ROOT, {'budget_line': str(line_for(setup).pk), 'date': '2026-10-31', 'currency': 'BIF',
        'details': json.dumps([{'label': 'Ciment', 'quantity': '2', 'unit_price': '25'}]),
        'receipt_files': [pdf(), pdf('facture.pdf')], **extra}, format='multipart')


def test_create_multiple_receipts_and_authenticated_download(setup):
    response = create(setup)
    assert response.status_code == 201, response.data
    assert response.data['status'] == 'draft' and response.data['amount_including_tax'] == '50.00'
    assert len(response.data['receipts']) == 2
    receipt = response.data['receipts'][0]
    assert 'file' not in receipt
    url = ROOT + str(response.data['id']) + '/receipts/' + str(receipt['id']) + '/download/'
    result = setup[-1].get(url)
    assert result.status_code == 200
    assert b''.join(result.streaming_content).startswith(b'%PDF-')
    assert result['Cache-Control'] == 'private, no-store'
    setup[-1].force_authenticate(None)
    assert setup[-1].get(url).status_code in [401, 403]


def test_draft_can_replace_receipts_atomically_and_deleted_receipt_is_hidden(setup):
    response = create(setup)
    url = ROOT + str(response.data['id']) + '/'
    receipt = response.data['receipts'][0]
    result = setup[-1].patch(url, {'receipt_files': [pdf('nouveau.pdf')], 'removed_receipts': [str(receipt['id'])]}, format='multipart')
    assert result.status_code == 200, result.data
    assert len(result.data['receipts']) == 2
    assert 'nouveau.pdf' in [row['original_name'] for row in result.data['receipts']]
    assert setup[-1].get(url + 'receipts/' + str(receipt['id']) + '/download/').status_code == 404
    assert Expense.objects.get(pk=response.data['id']).status == 'draft'


@pytest.mark.parametrize('status', ['submitted', 'validated', 'paid', 'rejected'])
def test_receipts_cannot_change_after_draft(setup, status):
    response = create(setup)
    expense = Expense.objects.get(pk=response.data['id'])
    expense.status = status; expense.save()
    url = ROOT + str(expense.pk) + '/'
    assert setup[-1].patch(url, {'receipt_files': [pdf()]}, format='multipart').status_code == 400
    assert setup[-1].patch(url, {'removed_receipts': [str(response.data['receipts'][0]['id'])]}, format='json').status_code == 400
    assert expense.receipts.filter(deleted_at__isnull=True).count() == 2


def test_invalid_file_rolls_back_entire_create(setup):
    result = create(setup, receipt_files=[pdf(), SimpleUploadedFile('fake.pdf', b'<html>bad</html>')])
    assert result.status_code == 400
    assert not Expense.objects.exists() and not ExpenseReceipt.objects.exists()
    result = create(setup, receipt_files=[SimpleUploadedFile('large.pdf', b'%PDF-' + b'0' * (10 * 1024 * 1024))])
    assert result.status_code == 400
    assert not Expense.objects.exists()


def test_receipt_access_is_scoped_to_expense_tenant_and_permissions(setup):
    response = create(setup)
    expense = Expense.objects.get(pk=response.data['id'])
    receipt_id = str(response.data['receipts'][0]['id'])
    other = Expense.objects.create(tenant=setup[0], budget_line=expense.budget_line, date=date(2026, 10, 31), amount_excluding_tax=1, amount_including_tax=1, currency='BIF')
    assert setup[-1].get(ROOT + f'{other.pk}/receipts/{receipt_id}/download/').status_code == 404
    assert setup[-1].patch(ROOT + f'{other.pk}/', {'removed_receipts': [receipt_id]}, format='json').status_code == 400
    url = ROOT + f'{expense.pk}/receipts/{receipt_id}/download/'
    user, _ = member(setup[0], code='reader', permissions={'budget': ['read']})
    setup[-1].force_authenticate(user)
    result = setup[-1].get(url)
    assert result.status_code == 200; result.close()
    assert setup[-1].patch(ROOT + f'{expense.pk}/', {'receipt_files': [pdf()]}, format='multipart').status_code == 403
    foreign = Tenant.objects.create(name='Foreign', slug='receipt-foreign')
    setup[-1].force_authenticate(setup[1])
    setup[-1].credentials(HTTP_X_TENANT_ID=str(foreign.pk))
    assert setup[-1].get(url).status_code == 404


def test_receipt_limits_and_stale_version_do_not_change_files(setup):
    response = create(setup)
    url = ROOT + str(response.data['id']) + '/'
    assert setup[-1].patch(url, {'receipt_files': [pdf(f'{i}.pdf') for i in range(19)]}, format='multipart').status_code == 400
    assert setup[-1].patch(url, {'receipt_files': [pdf()]}, format='multipart', HTTP_IF_MATCH='0').status_code == 409
    assert ExpenseReceipt.objects.filter(deleted_at__isnull=True).count() == 2
    assert setup[-1].get(url + 'receipts/not-a-uuid/download/').status_code == 404
