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

    class Meta:
        constraints = [models.UniqueConstraint(
            fields=["document"], condition=models.Q(is_current=True, deleted_at__isnull=True),
            name="one_current_document_version",
        )]


class DocumentAcl(TenantOwnedModel):
    READ = "read"
    WRITE = "write"
    APPROVE = "approve"

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="acls")
    role = models.ForeignKey("accounts.Role", null=True, blank=True, on_delete=models.CASCADE)
    user = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.CASCADE)
    permission = models.CharField(max_length=20, default=READ)


class ApprovalWorkflow(TenantOwnedModel):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="approval_workflows")
    requested_by = models.ForeignKey("accounts.User", on_delete=models.PROTECT, related_name="+")
    reviewer = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    status = models.CharField(max_length=20, default=PENDING)
    comment = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
