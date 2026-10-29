from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from apps.accounts.models import AuditLog, Device, Membership, Role, Tenant, User
from apps.accounts.serializers import (
    AuditLogSerializer,
    DeviceSerializer,
    MembershipWriteSerializer,
    RoleSerializer,
    TenantSerializer,
    UserMeSerializer,
    UserSerializer,
)
from apps.common.permissions import HasTenantContext, IsTenantMember
from apps.common.viewsets import TenantModelViewSet
from apps.accounts.permissions import CanManageGlobalUsers, IsTenantAdministrator
from apps.common.concurrency import VersionedWriteMixin


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data)


class DirectoryView(APIView):
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember]

    def get(self, request):
        users = User.objects.filter(
            memberships__tenant_id=request.tenant_id, memberships__is_active=True, is_active=True
        ).distinct().order_by("first_name", "last_name", "email")
        return Response([{"id": user.pk, "name": user.get_full_name() or user.email,
                          "email": user.email} for user in users])


class TenantViewSet(ReadOnlyModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Tenant.objects.all()
        return Tenant.objects.filter(memberships__user=self.request.user, memberships__is_active=True)


class RoleDirectoryView(APIView):
    """Expose role names for sharing selectors without administration access."""
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember]

    def get(self, request):
        return Response(list(Role.objects.filter(tenant_id=request.tenant_id)
                             .order_by("name").values("id", "code", "name")))


class UserViewSet(VersionedWriteMixin, ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember, CanManageGlobalUsers]
    ordering = "-date_joined"
    ordering_fields = ["date_joined", "email", "username", "last_name"]
    search_fields = ["email", "username", "first_name", "last_name"]

    def get_queryset(self):
        return User.objects.filter(memberships__tenant_id=self.request.tenant_id).distinct()

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if (request.method in {"POST", "PUT", "PATCH", "DELETE"}
                and response.status_code < 300 and request.user.is_authenticated):
            data = getattr(response, "data", None) or {}
            AuditLog.objects.create(
                tenant_id=request.tenant_id, user=request.user, action=self.action,
                resource_type="accounts.User",
                resource_id=str(self.kwargs.get("pk") or data.get("id", "")),
                correlation_id=str(getattr(request, "correlation_id", ""))[:64],
            )
        return response


class RoleViewSet(TenantModelViewSet):
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember, IsTenantAdministrator]
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at"]


class MembershipViewSet(TenantModelViewSet):
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember, IsTenantAdministrator]
    queryset = Membership.objects.select_related("user", "role", "tenant")
    serializer_class = MembershipWriteSerializer
    filterset_fields = ["is_active", "role"]


class DeviceViewSet(TenantModelViewSet):
    queryset = Device.objects.select_related("user", "tenant")
    serializer_class = DeviceSerializer
    filterset_fields = ["platform", "is_active", "user"]


class AuditLogViewSet(ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember, IsTenantAdministrator]
    filterset_fields = ["tenant", "user", "action", "resource_type"]
    ordering_fields = ["created_at", "action"]

    def get_queryset(self):
        return AuditLog.objects.filter(tenant_id=self.request.tenant_id)
