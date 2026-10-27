from django.db import models, transaction
from django.utils import timezone

from apps.documents.models import ApprovalWorkflow, Document, DocumentVersion
from rest_framework.exceptions import PermissionDenied, ValidationError


@transaction.atomic
def mark_version_current(version: DocumentVersion, user) -> DocumentVersion:
    Document.objects.select_for_update().get(pk=version.document_id)
    DocumentVersion.objects.filter(
        tenant=version.tenant,
        document=version.document,
        is_current=True,
    ).exclude(id=version.id).update(is_current=False, updated_by=user,
                                  version=models.F("version") + 1, updated_at=timezone.now())
    version.is_current = True
    version.updated_by = user
    version.version += 1
    version.save(update_fields=["is_current", "updated_by", "version", "updated_at"])
    return version


def approve_document(document: Document, user) -> Document:
    document.status = Document.APPROVED
    document.updated_by = user
    document.version += 1
    document.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return document


@transaction.atomic
def decide_workflow(workflow: ApprovalWorkflow, status: str, user, comment: str = "") -> ApprovalWorkflow:
    workflow = ApprovalWorkflow.objects.select_for_update().get(pk=workflow.pk)
    if workflow.reviewer_id != user.pk:
        raise PermissionDenied("Seul le reviseur designe peut prendre cette decision.")
    if workflow.status != ApprovalWorkflow.PENDING:
        raise ValidationError("Ce workflow a deja ete traite.")
    if status not in {ApprovalWorkflow.APPROVED, ApprovalWorkflow.REJECTED}:
        raise ValidationError("Decision invalide.")
    workflow.status = status
    workflow.reviewer = user
    workflow.comment = comment
    workflow.decided_at = timezone.now()
    workflow.updated_by = user
    workflow.version += 1
    workflow.save(
        update_fields=["status", "reviewer", "comment", "decided_at", "updated_by", "version", "updated_at"]
    )
    Document.objects.filter(pk=workflow.document_id).update(
        status=Document.APPROVED if status == ApprovalWorkflow.APPROVED else Document.REFUSED,
        updated_by=user, updated_at=timezone.now(), version=models.F("version") + 1,
    )
    return workflow
