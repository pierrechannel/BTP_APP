from django.db import transaction

from apps.documents.models import DocumentVersion


@transaction.atomic
def mark_version_current(version: DocumentVersion, user) -> DocumentVersion:
    DocumentVersion.objects.filter(
        tenant=version.tenant,
        document=version.document,
        is_current=True,
    ).exclude(id=version.id).update(is_current=False, updated_by=user)
    version.is_current = True
    version.updated_by = user
    version.version += 1
    version.save(update_fields=["is_current", "updated_by", "version", "updated_at"])
    return version
