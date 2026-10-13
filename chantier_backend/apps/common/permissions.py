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
