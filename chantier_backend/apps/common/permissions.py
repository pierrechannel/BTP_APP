from uuid import UUID

from rest_framework.permissions import BasePermission


class HasTenantContext(BasePermission):
    message = "Aucun tenant courant n'a ete fourni."

    def has_permission(self, request, view):
        try:
            UUID(str(getattr(request, "tenant_id", "")))
            return True
        except (ValueError, TypeError):
            return False


class TenantObjectPermission(BasePermission):
    message = "Ressource introuvable dans le tenant courant."

    def has_object_permission(self, request, view, obj):
        tenant_id = getattr(request, "tenant_id", None)
        return bool(tenant_id and str(getattr(obj, "tenant_id", "")) == str(tenant_id))


class IsTenantMember(BasePermission):
    message = "Utilisateur non membre du tenant courant."

    def has_permission(self, request, view):
        tenant_id = getattr(request, "tenant_id", None)
        user = getattr(request, "user", None)
        if not tenant_id or not user or not user.is_authenticated:
            return False
        from apps.accounts.models import Membership, Tenant

        if not Tenant.objects.filter(pk=tenant_id, is_active=True).exists():
            return False
        if user.is_superuser:
            return True

        return Membership.objects.filter(user=user, tenant_id=tenant_id, is_active=True).exists()


SAFE_METHOD_ACTION = {
    "GET": "read",
    "HEAD": "read",
    "OPTIONS": "read",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


class HasRolePermission(BasePermission):
    message = "Role insuffisant pour cette action."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        tenant_id = getattr(request, "tenant_id", None)
        if not user or not user.is_authenticated or not tenant_id:
            return False
        if user.is_superuser:
            return True

        from apps.accounts.models import Membership

        membership = (
            Membership.objects.select_related("role")
            .filter(user=user, tenant_id=tenant_id, is_active=True)
            .first()
        )
        if not membership:
            return False

        permissions = membership.role.permissions or {}
        resource = getattr(view, "resource_name", None)
        if resource is None:
            model = getattr(getattr(view, "queryset", None), "model", None)
            resource = getattr(getattr(model, "_meta", None), "app_label", None)
        if resource is None:
            return False

        view_action = getattr(view, "action", None)
        action = getattr(view, "permission_action_map", {}).get(view_action, view_action)
        action = action or SAFE_METHOD_ACTION.get(request.method)
        action = self.normalize_action(action, request.method)
        allowed = set(permissions.get(resource, [])) | set(permissions.get("*", []))
        if action == "metadata":
            return bool(allowed & {"read", "read_shared", "create", "update", "crud"})
        return (action in allowed or ("crud" in allowed and action in {"create", "read", "update", "delete"})
                or (resource == "documents" and action == "read" and "read_shared" in allowed))

    def normalize_action(self, action, method):
        if action == "list" or action == "retrieve":
            return "read"
        if action == "partial_update":
            return "update"
        if action == "destroy":
            return "delete"
        return action or SAFE_METHOD_ACTION.get(method)
