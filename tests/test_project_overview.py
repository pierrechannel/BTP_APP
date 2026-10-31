from datetime import date
from unittest.mock import patch

import pytest
from django.utils import timezone

from apps.accounts.models import Tenant
from apps.budget.models import Budget, BudgetLine, Expense
from apps.planning.models import Task
from apps.progress.models import DailyReport
from apps.projects.models import Project
from apps.workforce.models import Worker, Assignment
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db


def url(project):
    return f'/api/v1/projects/{project.pk}/overview/'


def test_overview_progress_excludes_cancelled_parents_and_includes_legacy_archives(setup):
    tenant, _, project, tasks, client = setup
    for task in tasks:
        task.deleted_at = timezone.now(); task.save()
    parent = Task.objects.create(tenant=tenant, project=project, name='Parent', progress_percent=0)
    Task.objects.create(tenant=tenant, project=project, parent=parent, name='Leaf', progress_percent=50, planned_end_date=date(2026, 10, 30))
    Task.objects.create(tenant=tenant, project=project, name='Complete', status='done', progress_percent=0)
    Task.objects.create(tenant=tenant, project=project, name='Cancelled', status='cancelled', progress_percent=0)
    Task.objects.create(tenant=tenant, project=project, name='Archived', archived_at=timezone.now(), progress_percent=0)
    with patch('apps.projects.overview.timezone.localdate', return_value=date(2026, 10, 31)):
        response = client.get(url(project))
    assert response.status_code == 200, response.data
    assert response.data['planning']['progress'] == 50
    assert response.data['planning']['overdue'] == 1
    assert response.data['planning']['count'] == 4


def test_overview_scopes_finances_activity_and_current_assignments(setup):
    tenant, _, project, _, client = setup
    other = Project.objects.create(tenant=tenant, code='OV-OTHER', name='Other')
    budget = Budget.objects.create(tenant=tenant, project=project)
    line = BudgetLine.objects.create(tenant=tenant, budget=budget, label='Travaux', amount=1000)
    for status, amount in [('submitted', 100), ('validated', 200), ('paid', 50), ('draft', 600)]:
        Expense.objects.create(tenant=tenant, budget_line=line, date=date(2026, 10, 31), amount_excluding_tax=amount, amount_including_tax=amount, currency='BIF', status=status)
    DailyReport.objects.create(tenant=tenant, project=project, report_date=date(2026, 10, 31))
    DailyReport.objects.create(tenant=tenant, project=other, report_date=date(2026, 10, 31))
    worker = Worker.objects.create(tenant=tenant, first_name='Alice', last_name='Test')
    for _ in range(2):
        Assignment.objects.create(tenant=tenant, project=project, worker=worker, start_date=date(2026, 10, 1))
    expired = Worker.objects.create(tenant=tenant, first_name='Expired', last_name='Test')
    Assignment.objects.create(tenant=tenant, project=project, worker=expired, start_date=date(2026, 10, 1), end_date=date(2026, 10, 30))
    with patch('apps.projects.overview.timezone.localdate', return_value=date(2026, 10, 31)):
        response = client.get(url(project))
    assert response.status_code == 200, response.data
    assert response.data['budget']['available'] == 650
    assert response.data['budget']['paid'] == 50
    assert response.data['budget']['pending'] == 1
    assert response.data['workforce']['assigned'] == 1
    assert len(response.data['activity']) == 1


def test_overview_permission_boundaries_and_empty_states(setup):
    tenant, _, project, tasks, client = setup
    user, _ = member(tenant, code='project_only', permissions={'projects': ['read']})
    client.force_authenticate(user)
    response = client.get(url(project))
    assert response.status_code == 200
    for module in ['planning', 'budget', 'qhse', 'workforce']:
        assert response.data[module] is None
    assert response.data['activity'] == []
    foreign = Tenant.objects.create(name='Foreign', slug='overview-foreign')
    hidden = Project.objects.create(tenant=foreign, name='Hidden', code='HIDDEN')
    assert client.get(url(hidden)).status_code == 404
    client.force_authenticate(setup[1])
    for task in tasks:
        task.delete()
    response = client.get(url(project))
    assert response.data['planning']['progress'] is None
    assert response.data['budget']['budget_id'] is None


def test_recent_documents_respect_document_access_rules(setup):
    from apps.documents.models import Document, DocumentAcl, Folder
    tenant, admin, project, _, client = setup
    user, _ = member(tenant, code='project_documents', permissions={'projects': ['read'], 'documents': ['read']})
    folder = Folder.objects.create(tenant=tenant, project=project, name='Plans')
    visible = Document.objects.create(tenant=tenant, folder=folder, title='Visible', created_by=admin)
    secret = Document.objects.create(tenant=tenant, folder=folder, title='Private', created_by=admin)
    DocumentAcl.objects.create(tenant=tenant, document=secret, user=admin, permission='read')
    client.force_authenticate(user)
    response = client.get(url(project))
    assert response.status_code == 200, response.data
    assert [str(row['id']) for row in response.data['activity']] == [str(visible.pk)]
