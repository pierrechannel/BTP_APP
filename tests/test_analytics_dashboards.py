from datetime import date, datetime, timezone
from unittest.mock import patch

import pytest

from apps.accounts.models import AuditLog, Tenant
from apps.budget.models import Budget, BudgetLine, Expense
from apps.projects.models import Project
from apps.reports.models import ReportRun, ReportTemplate
from apps.workforce.models import Worker, TimeEntry
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db


def test_platform_trend_is_global_zero_filled_and_uses_bujumbura_dates(setup):
    tenant, user, _, _, client = setup
    other = Tenant.objects.create(name='Second', slug='dash-second')
    events = [AuditLog.objects.create(tenant=scope, user=user, action='test') for scope in (tenant, other, tenant)]
    for event, stamp in zip(events, [datetime(2026, 10, 29, 22, 30, tzinfo=timezone.utc),
        datetime(2026, 10, 25, 8, tzinfo=timezone.utc), datetime(2026, 10, 23, 8, tzinfo=timezone.utc)]):
        AuditLog.objects.filter(pk=event.pk).update(created_at=stamp)
    with patch('apps.accounts.platform_analytics.timezone.now', return_value=datetime(2026, 10, 30, 10, tzinfo=timezone.utc)):
        response = client.get('/api/v1/auth/platform/overview/', {'days': 7})
    assert response.status_code == 200
    data = response.data
    assert len(data['activity']) == 7
    assert data['activity'][0]['date'] == date(2026, 10, 24)
    assert data['activity'][-1]['events'] == 1
    assert data['activity'][0]['events'] == 0
    assert data['period_summary']['events'] == 2
    assert data['previous_summary']['events'] == 1
    assert data['active_tenants_in_period'] == 2
    assert {row['tenant_name'] for row in data['recent_events']} == {'Entreprise', 'Second'}
    assert client.get('/api/v1/auth/platform/overview/', {'days': 5000}).status_code == 400
    user, _ = member(tenant, 'dashboard-reader', {'*': ['crud']})
    client.force_authenticate(user)
    assert client.get('/api/v1/auth/platform/overview/').status_code == 403


def test_reports_dashboard_scopes_attendance_expenses_and_generated_editions(setup):
    tenant, _, project, _, client = setup
    worker = Worker.objects.create(tenant=tenant, first_name='Alice', last_name='Test')
    TimeEntry.objects.create(tenant=tenant, project=project, worker=worker, work_date=date(2026, 10, 30), normal_hours=8, overtime_hours=2, is_validated=True)
    TimeEntry.objects.create(tenant=tenant, project=project, worker=worker, work_date=date(2026, 9, 1), normal_hours=5)
    budget = Budget.objects.create(tenant=tenant, project=project)
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, label='Travaux', category='Matériaux', amount=1000)
    for status, amount in [('draft', 10), ('validated', 20), ('paid', 30)]:
        Expense.objects.create(tenant=tenant, budget_line=line, date=date(2026, 10, 30), amount_excluding_tax=amount,
            amount_including_tax=amount, currency='BIF', status=status)
    template = ReportTemplate.objects.create(tenant=tenant, name='Rapport')
    run = ReportRun.objects.create(tenant=tenant, template=template, status='completed', parameters={'project': project.code})
    ReportRun.objects.filter(pk=run.pk).update(created_at=datetime(2026, 10, 30, 10, tzinfo=timezone.utc))
    ReportRun.objects.create(tenant=tenant, template=template, status='failed', parameters={})
    foreign = Tenant.objects.create(name='Secret', slug='dashboard-secret')
    secret = Project.objects.create(tenant=foreign, name='Projet secret')
    foreign_worker = Worker.objects.create(tenant=foreign, first_name='Secret', last_name='Test')
    TimeEntry.objects.create(tenant=foreign, worker=foreign_worker, project=secret, work_date=date(2026, 10, 30), normal_hours=24)
    response = client.get('/api/v1/reports/templates/summary/', {'project': project.pk, 'start_date': '2026-10-01', 'end_date': '2026-10-31'})
    assert response.status_code == 200
    data = response.data
    assert data['attendance']['workers'] == 1 and data['attendance']['entries'] == 1
    assert data['attendance']['normal_hours'] == 8 and data['attendance']['overtime_hours'] == 2
    assert data['attendance']['validated'] == 1
    assert data['spending_categories'] == [{'budget_line__category': 'Matériaux', 'currency': 'BIF', 'amount': 50}]
    assert sum(row['count'] for row in data['expense_statuses']) == 3
    assert data['report_statuses'] == [{'status': 'completed', 'count': 1}]
    assert data['monthly_reports'][0]['count'] == 1
    assert len(data['recent_expenses']) == 3
    empty = client.get('/api/v1/reports/templates/summary/', {'project': secret.pk}).data
    assert empty['attendance']['workers'] == 0 and empty['recent_expenses'] == [] and empty['report_statuses'] == []


def test_report_editions_use_created_date_and_do_not_change_financial_totals(setup):
    tenant, _, _, _, client = setup
    template = ReportTemplate.objects.create(tenant=tenant, name='Synthèse')
    early = ReportRun.objects.create(tenant=tenant, template=template, status='completed')
    late = ReportRun.objects.create(tenant=tenant, template=template, status='pending')
    ReportRun.objects.filter(pk=early.pk).update(created_at=datetime(2026, 10, 29, 21, 59, tzinfo=timezone.utc))
    ReportRun.objects.filter(pk=late.pk).update(created_at=datetime(2026, 10, 29, 22, 1, tzinfo=timezone.utc))
    data = client.get('/api/v1/reports/templates/summary/', {'start_date': '2026-10-30', 'end_date': '2026-10-30'}).data
    assert data['report_statuses'] == [{'status': 'pending', 'count': 1}]
    assert data['finances'] == []
