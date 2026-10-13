from rest_framework.permissions import IsAdminUser, IsAuthenticated
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


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data)


class TenantViewSet(ReadOnlyModelViewSet):
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Tenant.objects.all()
        return Tenant.objects.filter(memberships__user=self.request.user, memberships__is_active=True)


class UserViewSet(ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember]
    ordering = "-date_joined"
    ordering_fields = ["date_joined", "email", "username", "last_name"]
    search_fields = ["email", "username", "first_name", "last_name"]

    def get_queryset(self):
        return User.objects.filter(memberships__tenant_id=self.request.tenant_id).distinct()


class RoleViewSet(TenantModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at"]


class MembershipViewSet(TenantModelViewSet):
    queryset = Membership.objects.select_related("user", "role", "tenant")
    serializer_class = MembershipWriteSerializer
    filterset_fields = ["is_active", "role"]


class DeviceViewSet(TenantModelViewSet):
    queryset = Device.objects.select_related("user", "tenant")
    serializer_class = DeviceSerializer
    filterset_fields = ["platform", "is_active", "user"]


class AuditLogViewSet(ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    filterset_fields = ["tenant", "user", "action", "resource_type"]
    ordering_fields = ["created_at", "action"]

    def get_queryset(self):
        return AuditLog.objects.all()
