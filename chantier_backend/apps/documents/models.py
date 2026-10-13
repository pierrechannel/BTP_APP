from django.db import models

from apps.common.models import TenantOwnedModel


class Folder(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="folders")
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    name = models.CharField(max_length=255)


class Document(TenantOwnedModel):
    DRAFT = "draft"
    REVIEW = "review"
    APPROVED = "approved"
    REFUSED = "refused"
    OBSOLETE = "obsolete"

    folder = models.ForeignKey(Folder, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default=DRAFT)


class DocumentVersion(TenantOwnedModel):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    version_label = models.CharField(max_length=40)
    file = models.FileField(upload_to="documents/")
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=128, blank=True)
    is_current = models.BooleanField(default=True)
