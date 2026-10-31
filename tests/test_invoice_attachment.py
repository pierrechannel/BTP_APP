import pytest
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.accounts.models import Tenant
from apps.budget.models import Invoice
from tests.test_regressions import setup, member  # noqa: F401

pytestmark = pytest.mark.django_db
ROOT = '/api/v1/budget/invoices/'


@pytest.fixture(autouse=True)
def private_invoice_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(Invoice._meta.get_field('file'), 'storage', FileSystemStorage(location=tmp_path))


def payload(setup):
    return {'project': str(setup[2].pk), 'invoice_number': 'UPLOAD-1', 'issue_date': '2026-10-31', 'currency': 'BIF', 'amount_excluding_tax': '100'}


def pdf(name='facture.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 test', content_type='application/pdf')


def test_invoice_upload_metadata_preservation_and_download(setup):
    client = setup[-1]
    options = client.options(ROOT)
    assert options.status_code == 200
    assert options.data['actions']['POST']['file']['type'] == 'file upload'
    response = client.post(ROOT, {**payload(setup), 'file': pdf()}, format='multipart')
    assert response.status_code == 201, response.data
    assert response.data['has_file'] and response.data['original_name'] == 'facture.pdf'
    assert 'file' not in response.data
    url = ROOT + str(response.data['id']) + '/'
    response = client.patch(url, {'supplier_name': 'Supplier'}, format='json')
    assert response.status_code == 200 and response.data['has_file']
    response = client.patch(url, {'file': pdf('remplacement.pdf')}, format='multipart')
    assert response.status_code == 200 and response.data['original_name'] == 'remplacement.pdf'
    result = client.get(url + 'file/download/')
    assert result.status_code == 200
    assert b''.join(result.streaming_content).startswith(b'%PDF-')
    assert result['Cache-Control'] == 'private, no-store'
    assert client.post(url + 'validate/').status_code == 200
    assert client.patch(url, {'file': pdf()}, format='multipart').status_code == 400
    invoice = Invoice.objects.get(pk=response.data['id'])
    assert invoice.original_name == 'remplacement.pdf'


def test_invoice_file_is_optional_and_validated(setup):
    client = setup[-1]
    response = client.post(ROOT, payload(setup), format='json')
    assert response.status_code == 201 and not response.data['has_file']
    url = ROOT + str(response.data['id']) + '/'
    assert client.get(url + 'file/download/').status_code == 404
    assert client.patch(url, {'file': SimpleUploadedFile('fake.pdf', b'not a PDF')}, format='multipart').status_code == 400
    assert client.patch(url, {'file': SimpleUploadedFile('large.pdf', b'%PDF-' + b'0' * (10 * 1024 * 1024))}, format='multipart').status_code == 400
    assert not Invoice.objects.get(pk=response.data['id']).file


def test_invoice_download_requires_tenant_and_read_permission(setup):
    client = setup[-1]
    response = client.post(ROOT, {**payload(setup), 'file': pdf()}, format='multipart')
    assert response.status_code == 201, response.data
    url = ROOT + str(response.data['id']) + '/file/download/'
    user, _ = member(setup[0], code='invoice_reader', permissions={'budget': ['read']})
    client.force_authenticate(user)
    result = client.get(url)
    assert result.status_code == 200; result.close()
    user, _ = member(setup[0], code='invoice_no_access', permissions={'projects': ['read']})
    client.force_authenticate(user)
    assert client.get(url).status_code == 403
    client.force_authenticate(setup[1])
    foreign = Tenant.objects.create(name='Other', slug='invoice-file-other')
    client.credentials(HTTP_X_TENANT_ID=str(foreign.pk))
    assert client.get(url).status_code == 404
