from django.db.models import Exists, OuterRef, Q
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Membership, Role
from apps.documents.models import Document, DocumentAcl


def is_document_admin(request):
    return request.user.is_superuser or Membership.objects.filter(
        tenant_id=request.tenant_id, user=request.user, is_active=True, role__code=Role.ADMIN
    ).exists()


def accessible_documents(request, permission="read"):
    documents = Document.objects.filter(
        tenant_id=request.tenant_id, deleted_at__isnull=True,
        folder__deleted_at__isnull=True, folder__project__deleted_at__isnull=True,
    )
    if is_document_admin(request):
        return documents
    membership = Membership.objects.select_related("role").get(
        user=request.user, tenant_id=request.tenant_id, is_active=True
    )
    permissions = {"read": ["read", "write", "approve"], "write": ["write"],
                   "approve": ["approve"]}[permission]
    acls = DocumentAcl.objects.filter(
        document_id=OuterRef("pk"), tenant_id=request.tenant_id, deleted_at__isnull=True
    )
    grants = acls.filter(Q(user=request.user) | Q(role=membership.role), permission__in=permissions)
    documents = documents.annotate(has_acl=Exists(acls), has_grant=Exists(grants))
    allowed = Q(created_by=request.user) | Q(has_grant=True)
    role_permissions = membership.role.permissions or {}
    actions = set(role_permissions.get("documents", [])) | set(role_permissions.get("*", []))
    if "read_shared" not in actions or "read" in actions or "crud" in actions:
        allowed |= Q(has_acl=False)
    return documents.filter(allowed)


def require_document_access(request, document, permission="write"):
    if not accessible_documents(request, permission).filter(pk=document.pk).exists():
        raise PermissionDenied("Droits insuffisants sur ce document.")
