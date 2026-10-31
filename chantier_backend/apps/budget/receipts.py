import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from rest_framework import serializers


def receipt_storage():
    return FileSystemStorage(location=getattr(settings, 'EXPENSE_RECEIPTS_ROOT', settings.BASE_DIR / 'private_receipts'))


def receipt_path(instance, filename):
    return f'{instance.tenant_id}/{instance.expense_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'


def invoice_path(instance, filename):
    return f'{instance.tenant_id}/invoices/{instance.pk}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'


def validate_receipt(file):
    if file.size > 10 * 1024 * 1024:
        raise serializers.ValidationError('Chaque justificatif doit faire au maximum 10 Mo.')
    suffix = Path(file.name).suffix.lower()
    header = file.read(16)
    file.seek(0)
    valid = {
        '.pdf': header.startswith(b'%PDF-'),
        '.png': header.startswith(b'\x89PNG\r\n\x1a\n'),
        '.jpg': header.startswith(b'\xff\xd8\xff'),
        '.jpeg': header.startswith(b'\xff\xd8\xff'),
        '.webp': header.startswith(b'RIFF') and header[8:12] == b'WEBP',
    }
    if not valid.get(suffix):
        raise serializers.ValidationError('Fournissez un fichier PDF, JPG, PNG ou WebP valide.')
    return file
