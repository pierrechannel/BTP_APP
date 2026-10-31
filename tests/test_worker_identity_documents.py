from django.core.files.uploadedfile import SimpleUploadedFile
import pytest
from tests.test_regressions import setup  # noqa: F401

pytestmark = pytest.mark.django_db


def test_worker_identity_documents_upload_and_preservation(setup, tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path
    _, _, _, _, client = setup
    root = '/api/v1/workforce/workers/'
    response = client.post(root, {
        'first_name': 'Alice', 'last_name': 'Test',
        'identity_document_front': SimpleUploadedFile('recto.pdf', b'%PDF-1.4 test', content_type='application/pdf'),
        'identity_document_back': SimpleUploadedFile('verso.png', b'example', content_type='image/png'),
    }, format='multipart')
    assert response.status_code == 201, response.data
    assert response.data['identity_document_front']
    assert response.data['identity_document_back']
    url = root + str(response.data['id']) + '/'
    version = response.data['version']
    response = client.patch(url, {'phone': '123'}, format='json', HTTP_IF_MATCH=str(version))
    assert response.status_code == 200, response.data
    assert response.data['identity_document_front']
    invalid = client.patch(url, {'identity_document_front': SimpleUploadedFile('bad.exe', b'bad')}, format='multipart', HTTP_IF_MATCH=str(response.data['version']))
    assert invalid.status_code == 400, invalid.data
