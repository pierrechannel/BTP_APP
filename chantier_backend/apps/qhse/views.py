from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.qhse.models import (
    CorrectiveAction,
    Incident,
    Inspection,
    InspectionItem,
    InspectionTemplate,
    Ppsps,
)
from apps.qhse.serializers import (
    CorrectiveActionSerializer,
    IncidentSerializer,
    InspectionItemSerializer,
    InspectionSerializer,
    InspectionTemplateSerializer,
    PpspsSerializer,
)
from apps.qhse.services import close_incident, complete_action, complete_inspection
from rest_framework.exceptions import ValidationError


class IncidentViewSet(TenantModelViewSet):
    queryset = Incident.objects.select_related("project", "tenant")
    serializer_class = IncidentSerializer
    filterset_fields = ["project", "status", "occurred_at"]
    search_fields = ["title", "description"]

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        incident = close_incident(self.get_object(), request.user)
        return Response(self.get_serializer(incident).data)


class CorrectiveActionViewSet(TenantModelViewSet):
    queryset = CorrectiveAction.objects.select_related("incident", "tenant")
    serializer_class = CorrectiveActionSerializer
    filterset_fields = ["incident", "due_date", "completed_at"]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        action = complete_action(self.get_object(), request.user)
        return Response(self.get_serializer(action).data)


class InspectionTemplateViewSet(TenantModelViewSet):
    queryset = InspectionTemplate.objects.select_related("tenant")
    serializer_class = InspectionTemplateSerializer
    search_fields = ["name", "code"]


class InspectionViewSet(TenantModelViewSet):
    queryset = Inspection.objects.select_related("project", "template", "tenant")
    serializer_class = InspectionSerializer
    filterset_fields = ["project", "template", "inspection_date", "status"]

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        inspection = complete_inspection(self.get_object(), request.user)
        return Response(self.get_serializer(inspection).data)


class InspectionItemViewSet(TenantModelViewSet):
    queryset = InspectionItem.objects.select_related("inspection", "tenant")
    serializer_class = InspectionItemSerializer
    filterset_fields = ["inspection", "is_compliant"]

    def perform_destroy(self, instance):
        if instance.inspection.status == Inspection.COMPLETED:
            raise ValidationError("Une inspection terminee ne peut plus etre modifiee.")
        super().perform_destroy(instance)


class PpspsViewSet(TenantModelViewSet):
    queryset = Ppsps.objects.select_related("project", "tenant")
    serializer_class = PpspsSerializer
    filterset_fields = ["project", "approved_at"]
    search_fields = ["reference", "notes"]
