from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.qhse.models import CorrectiveAction, Incident
from apps.qhse.serializers import CorrectiveActionSerializer, IncidentSerializer
from apps.qhse.services import close_incident, complete_action


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
