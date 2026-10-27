from rest_framework.permissions import BasePermission, SAFE_METHODS

from apps.accounts.models import Membership, Role


class IsTenantAdministrator(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_superuser or Membership.objects.filter(
            tenant_id=request.tenant_id, user=request.user, is_active=True, role__code=Role.ADMIN
        ).exists()


class CanManageGlobalUsers(IsTenantAdministrator):
    message = "Seul un administrateur plateforme peut modifier les comptes globaux."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return super().has_permission(request, view)
        return request.user.is_superuser
