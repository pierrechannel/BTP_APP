from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.sync.models import SyncMutation
from apps.sync.serializers import SyncMutationSerializer
from apps.sync.services import mark_mutation_applied, mark_mutation_failed
from rest_framework import serializers, status
from apps.common.concurrency import VersionConflict


class SyncMutationViewSet(TenantModelViewSet):
    queryset = SyncMutation.objects.select_related("device", "tenant")
    serializer_class = SyncMutationSerializer
    filterset_fields = ["device", "resource_type", "operation", "status"]
    search_fields = ["resource_type", "operation"]

    def create(self, request, *args, **kwargs):
        mutation_id = serializers.UUIDField().run_validation(request.data.get("client_mutation_id"))
        existing = self.get_queryset().filter(client_mutation_id=mutation_id).first()
        if existing:
            incoming = self.get_serializer(data=request.data)
            incoming.is_valid(raise_exception=True)
            for name in ["resource_type", "resource_id", "operation", "payload", "device"]:
                if name in incoming.validated_data and incoming.validated_data[name] != getattr(existing, name):
                    raise VersionConflict("Cet identifiant de mutation a deja ete utilise pour un autre contenu.")
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="mark-applied")
    def mark_applied(self, request, pk=None):
        mutation = mark_mutation_applied(self.get_object(), request.user)
        return Response(self.get_serializer(mutation).data)

    @action(detail=True, methods=["post"], url_path="mark-failed")
    def mark_failed(self, request, pk=None):
        mutation = mark_mutation_failed(self.get_object(), request.data.get("error", {}), request.user)
        return Response(self.get_serializer(mutation).data)
