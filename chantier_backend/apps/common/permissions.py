from rest_framework.permissions import BasePermission


class HasTenantContext(BasePermission):
    message = "Aucun tenant courant n'a ete fourni."

    def has_permission(self, request, view):
        return bool(getattr(request, "tenant_id", None))


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
        if user.is_superuser:
            return True

        from apps.accounts.models import Membership

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
        if "*" in permissions:
            return True

        resource = getattr(view, "resource_name", None)
        if resource is None:
            model = getattr(getattr(view, "queryset", None), "model", None)
            resource = getattr(getattr(model, "_meta", None), "app_label", None)
        if resource is None:
            return False

        action = getattr(view, "action", None) or SAFE_METHOD_ACTION.get(request.method)
        action = self.normalize_action(action, request.method)
        allowed = set(permissions.get(resource, []))
        return action in allowed or "crud" in allowed

    def normalize_action(self, action, method):
        if action == "list" or action == "retrieve":
            return "read"
        if action == "partial_update":
            return "update"
        if action == "destroy":
            return "delete"
        return action or SAFE_METHOD_ACTION.get(method)
