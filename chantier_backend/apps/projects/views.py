from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Membership, Tenant
from apps.common.viewsets import TenantModelViewSet
from apps.common.permissions import HasRolePermission, HasTenantContext, IsTenantMember, TenantObjectPermission
from apps.projects.models import Lot, Project, Stakeholder
from apps.projects.serializers import LotSerializer, ProjectSerializer, StakeholderSerializer
from apps.projects.services import InvalidProjectStatusTransition, create_project, transition_project_status


class ProjectViewSet(TenantModelViewSet):
    permission_action_map = {**TenantModelViewSet.permission_action_map, 'overview': 'read'}

    @action(detail=True, methods=['get'])
    def overview(self, request, pk=None):
        from apps.projects.overview import project_overview
        return Response(project_overview(request, self.get_object()))
    serializer_class = ProjectSerializer
    permission_classes = [
        IsAuthenticated,
        HasTenantContext,
        IsTenantMember,
        HasRolePermission,
        TenantObjectPermission,
    ]
    resource_name = "projects"
    search_fields = ["name", "code", "client_name"]
    ordering_fields = ["name", "code", "planned_start_date", "status", "created_at"]
    filterset_fields = ["status", "currency"]

    def get_queryset(self):
        return (
            Project.objects.filter(tenant_id=self.request.tenant_id, deleted_at__isnull=True)
            .annotate(lots_count=Count("lots", filter=Q(lots__deleted_at__isnull=True)))
            .select_related("tenant")
        )

    def perform_create(self, serializer):
        tenant = get_object_or_404(Tenant, id=self.request.tenant_id, is_active=True)
        if not self.request.user.is_superuser:
            get_object_or_404(Membership, tenant=tenant, user=self.request.user, is_active=True)
        project = create_project(tenant=tenant, user=self.request.user, data=serializer.validated_data)
        serializer.instance = project

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user, version=serializer.instance.version + 1)

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        project = self.get_object()
        to_status = request.data.get("to_status")
        reason = request.data.get("reason", "")

        try:
            transition_project_status(
                project=project,
                to_status=to_status,
                user=request.user,
                reason=reason,
            )
        except InvalidProjectStatusTransition as exc:
            return Response(
                {"code": "invalid_status_transition", "message": str(exc), "details": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(self.get_serializer(project).data)


class LotViewSet(TenantModelViewSet):
    queryset = Lot.objects.select_related("project", "tenant")
    serializer_class = LotSerializer
    filterset_fields = ["project", "code"]
    search_fields = ["name", "code", "subcontractor_name"]


class StakeholderViewSet(TenantModelViewSet):
    queryset = Stakeholder.objects.select_related("project", "tenant")
    serializer_class = StakeholderSerializer
    filterset_fields = ["project", "stakeholder_type"]
    search_fields = ["name", "email", "phone"]
