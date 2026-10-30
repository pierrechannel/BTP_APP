from datetime import date

import pytest

from apps.accounts.models import Tenant
from apps.workforce.models import Worker, Assignment, TimeEntry
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db
ROOT = '/api/v1/workforce/time-entries/'


def assigned(tenant, project, name='Alice', **kwargs):
    worker = Worker.objects.create(tenant=tenant, first_name=name, last_name='Test')
    Assignment.objects.create(tenant=tenant, project=project, worker=worker, start_date=date(2026, 10, 1), **kwargs)
    return worker


def test_sheet_uses_assignments_dates_and_deduplicates(setup):
    tenant, _, project, _, client = setup
    active = assigned(tenant, project)
    Assignment.objects.create(tenant=tenant, project=project, worker=active, start_date=date(2026, 10, 30), end_date=date(2026, 10, 30))
    assigned(tenant, project, 'Expired', end_date=date(2026, 10, 29))
    Worker.objects.create(tenant=tenant, first_name='Unassigned', last_name='Test')
    response = client.get(ROOT + 'sheet/', {'project': project.pk, 'work_date': '2026-10-30'})
    assert response.status_code == 200
    assert [str(row['worker']) for row in response.data['rows']] == [str(active.pk)]
    assert response.data['rows'][0]['normal_hours'] == ''


def test_sheet_saves_multiple_workers_and_prevents_duplicate_replay(setup):
    tenant, _, project, _, client = setup
    workers = [assigned(tenant, project, name) for name in ('Alice', 'Bob')]
    payload = {'project': str(project.pk), 'work_date': '2026-10-30', 'entries': [
        {'worker': str(worker.pk), 'normal_hours': '8', 'overtime_hours': '1.5'} for worker in workers]}
    response = client.post(ROOT + 'save-sheet/', payload, format='json')
    assert response.status_code == 200, response.data
    assert response.data['count'] == 2
    assert TimeEntry.objects.count() == 2
    assert client.post(ROOT + 'save-sheet/', payload, format='json').status_code == 409
    assert TimeEntry.objects.count() == 2


def test_sheet_rolls_back_all_rows_when_one_exceeds_daily_limit(setup):
    tenant, _, project, _, client = setup
    alice, bob = assigned(tenant, project), assigned(tenant, project, 'Bob')
    response = client.post(ROOT + 'save-sheet/', {'project': str(project.pk), 'work_date': '2026-10-30', 'entries': [
        {'worker': str(alice.pk), 'normal_hours': '8', 'overtime_hours': '0'},
        {'worker': str(bob.pk), 'normal_hours': '24', 'overtime_hours': '1'}]}, format='json')
    assert response.status_code == 400
    assert not TimeEntry.objects.exists()


def test_sheet_preserves_tasks_and_checks_versions_and_validation(setup):
    tenant, _, project, tasks, client = setup
    worker = assigned(tenant, project)
    entry = TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, task=tasks[0], work_date=date(2026, 10, 30), normal_hours=8)
    payload = {'project': str(project.pk), 'work_date': '2026-10-30', 'entries': [
        {'worker': str(worker.pk), 'entry_id': str(entry.pk), 'version': 1, 'normal_hours': '7', 'overtime_hours': '1'}]}
    assert client.post(ROOT + 'save-sheet/', payload, format='json').status_code == 200
    entry.refresh_from_db()
    assert entry.task_id == tasks[0].pk and entry.version == 2 and entry.normal_hours == 7
    assert client.post(ROOT + 'save-sheet/', payload, format='json').status_code == 409
    entry.is_validated = True
    entry.save()
    payload['entries'][0]['version'] = 2
    assert client.post(ROOT + 'save-sheet/', payload, format='json').status_code == 400


def test_sheet_rejects_foreign_scope_unassigned_workers_and_update_without_permission(setup):
    tenant, _, project, _, client = setup
    worker = assigned(tenant, project)
    other = Tenant.objects.create(name='Other', slug='sheet-other')
    foreign = Worker.objects.create(tenant=other, first_name='Secret', last_name='Person')
    payload = {'project': str(project.pk), 'work_date': '2026-10-30', 'entries': [
        {'worker': str(foreign.pk), 'normal_hours': '8', 'overtime_hours': '0'}]}
    assert client.post(ROOT + 'save-sheet/', payload, format='json').status_code == 400
    entry = TimeEntry.objects.create(tenant=tenant, worker=worker, project=project, work_date=date(2026, 10, 30), normal_hours=8)
    user, _ = member(tenant, 'sheet-create', {'workforce': ['read', 'create']})
    client.force_authenticate(user)
    payload['entries'][0].update(worker=str(worker.pk), entry_id=str(entry.pk), version=1)
    assert client.post(ROOT + 'save-sheet/', payload, format='json').status_code == 403
    entry.refresh_from_db()
    assert entry.version == 1
