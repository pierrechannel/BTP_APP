from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.sync.models import SyncMutation
from apps.sync.serializers import SyncMutationSerializer
from apps.sync.services import mark_mutation_applied, mark_mutation_failed


class SyncMutationViewSet(TenantModelViewSet):
    queryset = SyncMutation.objects.select_related("device", "tenant")
    serializer_class = SyncMutationSerializer
    filterset_fields = ["device", "resource_type", "operation", "status"]
    search_fields = ["resource_type", "operation"]

    @action(detail=True, methods=["post"], url_path="mark-applied")
    def mark_applied(self, request, pk=None):
        mutation = mark_mutation_applied(self.get_object(), request.user)
        return Response(self.get_serializer(mutation).data)

    @action(detail=True, methods=["post"], url_path="mark-failed")
    def mark_failed(self, request, pk=None):
        mutation = mark_mutation_failed(self.get_object(), request.data.get("error", {}), request.user)
        return Response(self.get_serializer(mutation).data)
