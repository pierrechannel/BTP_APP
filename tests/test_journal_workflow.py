from datetime import date
from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from pypdf import PdfReader

from apps.progress.models import DailyReport, Photo, ProgressUpdate, Snag
from apps.projects.models import Project
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db
ROOT = '/api/v1/progress/'


def image():
    stream = BytesIO(); Image.new('RGB', (20, 20), 'green').save(stream, 'PNG')
    return SimpleUploadedFile('terrain.png', stream.getvalue(), content_type='image/png')


def report(setup, **kwargs):
    return DailyReport.objects.create(tenant=setup[0], project=setup[2], report_date=date(2026, 10, 31), **kwargs)


def test_journal_submission_correction_and_validated_deletion_lock(setup):
    client = setup[-1]; obj = report(setup)
    url = ROOT + f'daily-reports/{obj.pk}/'
    assert client.post(url + 'submit/').status_code == 400
    assert client.patch(url, {'work_done': 'Fondations'}).status_code == 200
    assert client.post(url + 'submit/').status_code == 200
    assert client.patch(url, {'work_done': 'Changed'}).status_code == 400
    assert client.delete(url).status_code == 400
    assert client.post(url + 'correction/', {'comment': ''}).status_code == 400
    assert client.post(url + 'correction/', {'comment': 'Précisez les quantités'}).status_code == 200
    assert client.patch(url, {'work_done': 'Fondations complètes'}).status_code == 200
    assert client.post(url + 'submit/').status_code == 200
    validated = client.post(url + 'validate/')
    assert validated.status_code == 200 and validated.data['validated_at']
    assert str(validated.data['validated_by']) == str(setup[1].pk)
    history = validated.data['workflow_history']
    assert [event['action'] for event in history] == ['created', 'submitted', 'correction', 'submitted', 'validated']
    assert history[2]['reason'] == 'Précisez les quantités'
    assert all(event['at'] and event['actor_id'] == str(setup[1].pk) for event in history[1:])
    assert validated.data['validator_name']
    assert client.delete(url).status_code == 400
    assert client.delete(f'/api/v1/projects/{setup[2].pk}/').status_code == 400
    assert client.post(url + 'correction/', {'comment': 'Changed'}).status_code == 400


def test_journal_bulk_photos_and_pdf(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = setup[-1]
    response = client.post(ROOT + 'daily-reports/', {'project': str(setup[2].pk), 'report_date': '2026-10-31', 'work_done': 'Fondations', 'photo_files': [image(), image()]}, format='multipart')
    assert response.status_code == 201, response.data
    assert len(response.data['photos']) == 2
    assert [event['action'] for event in response.data['workflow_history']] == ['created']
    assert not response.data['workflow_history'][0].get('legacy')
    url = ROOT + f"daily-reports/{response.data['id']}/"
    pdf = client.get(url + 'pdf/')
    assert pdf.status_code == 200 and pdf['Content-Type'] == 'application/pdf'
    assert 'Fondations' in '\n'.join(page.extract_text() for page in PdfReader(BytesIO(pdf.content)).pages)
    photo_id = str(response.data['photos'][0]['id'])
    removed = client.patch(url, {'removed_photos': [photo_id]}, format='json')
    assert removed.status_code == 200 and len(removed.data['photos']) == 1
    assert client.post(url + 'submit/').status_code == 200
    photo_id = str(removed.data['photos'][0]['id'])
    assert client.patch(ROOT + f'photos/{photo_id}/', {'daily_report': None}, format='json').status_code == 400
    assert client.delete(ROOT + f'photos/{photo_id}/').status_code == 400
    assert client.post(ROOT + 'photos/', {'project': str(setup[2].pk), 'daily_report': str(response.data['id']), 'image': image()}, format='multipart').status_code == 400


def test_journal_photos_are_atomic_and_scoped(setup, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = setup[-1]
    response = client.post(ROOT + 'daily-reports/', {'project': str(setup[2].pk), 'report_date': '2026-10-31', 'photo_files': [image(), SimpleUploadedFile('bad.png', b'bad')]}, format='multipart')
    assert response.status_code == 400
    assert DailyReport.objects.count() == Photo.objects.count() == 0
    first, second = report(setup), report(setup)
    photo = Photo.objects.create(tenant=setup[0], project=setup[2], daily_report=first, image=image())
    assert client.patch(ROOT + f'daily-reports/{second.pk}/', {'removed_photos': [str(photo.pk)]}, format='json').status_code == 400


def test_progress_updates_latest_date_controls_task_and_deletion_recomputes(setup):
    client = setup[-1]; task = setup[3][0]
    base = {'project': str(setup[2].pk), 'task': str(task.pk)}
    newer = client.post(ROOT + 'progress-updates/', {**base, 'update_date': '2026-10-31', 'progress_percent': 100}, format='json')
    assert newer.status_code == 201, newer.data
    task.refresh_from_db(); assert task.progress_percent == 100 and task.status == 'done'
    older = client.post(ROOT + 'progress-updates/', {**base, 'update_date': '2026-10-30', 'progress_percent': 50}, format='json')
    assert older.status_code == 201
    task.refresh_from_db(); assert task.progress_percent == 100
    assert client.post(ROOT + 'progress-updates/', {**base, 'update_date': '2026-10-31', 'progress_percent': 101}, format='json').status_code == 400
    assert client.delete(ROOT + f"progress-updates/{newer.data['id']}/").status_code == 204
    task.refresh_from_db(); assert task.progress_percent == 50 and task.status == 'in_progress'


def test_snag_transitions_control_resolution_timestamp(setup):
    client = setup[-1]
    snag = Snag.objects.create(tenant=setup[0], project=setup[2], title='Fissure')
    url = ROOT + f'snags/{snag.pk}/'
    assert client.patch(url, {'status': 'closed', 'resolved_at': '2026-10-31T10:00:00Z'}, format='json').status_code == 200
    snag.refresh_from_db(); assert snag.status == 'open' and snag.resolved_at is None
    assert client.post(url + 'transition/', {'status': 'closed'}).status_code == 400
    assert client.post(url + 'transition/', {'status': 'in_progress'}).status_code == 200
    assert client.post(url + 'resolve/').status_code == 200
    assert client.post(url + 'transition/', {'status': 'open'}).status_code == 200
    snag.refresh_from_db(); assert snag.resolved_at is None
    assert client.post(url + 'resolve/').status_code == 200
    assert client.post(url + 'transition/', {'status': 'closed'}).status_code == 200
    assert client.patch(url, {'title': 'Changed'}).status_code == 400


def test_journal_filters_permissions_and_metadata(setup):
    client = setup[-1]; obj = report(setup, work_done='Fondations')
    other_project = Project.objects.create(tenant=setup[0], name='Other', code='J-OTHER')
    DailyReport.objects.create(tenant=setup[0], project=other_project, report_date=date(2026, 10, 30))
    response = client.get(ROOT + 'daily-reports/', {'project': str(setup[2].pk), 'start_date': '2026-10-31', 'end_date': '2026-10-31'})
    assert response.status_code == 200 and len(response.data['results']) == 1
    assert client.options(ROOT + 'daily-reports/').status_code == 200
    user, _ = member(setup[0], code='journal_reader', permissions={'progress': ['read']})
    client.force_authenticate(user)
    assert client.post(ROOT + f'daily-reports/{obj.pk}/correction/', {'comment': 'Test'}).status_code == 403
    assert client.get(ROOT + f'daily-reports/{obj.pk}/pdf/').status_code == 200
