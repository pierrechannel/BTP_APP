from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.documents.models import Document, DocumentVersion, Folder
from apps.documents.serializers import DocumentSerializer, DocumentVersionSerializer, FolderSerializer
from apps.documents.services import mark_version_current


class FolderViewSet(TenantModelViewSet):
    queryset = Folder.objects.select_related("project", "parent", "tenant")
    serializer_class = FolderSerializer
    filterset_fields = ["project", "parent"]
    search_fields = ["name"]


class DocumentViewSet(TenantModelViewSet):
    queryset = Document.objects.select_related("folder", "tenant")
    serializer_class = DocumentSerializer
    filterset_fields = ["folder", "status"]
    search_fields = ["title"]


class DocumentVersionViewSet(TenantModelViewSet):
    queryset = DocumentVersion.objects.select_related("document", "tenant")
    serializer_class = DocumentVersionSerializer
    filterset_fields = ["document", "version_label", "is_current", "mime_type"]
    search_fields = ["original_name", "version_label"]

    @action(detail=True, methods=["post"], url_path="mark-current")
    def mark_current(self, request, pk=None):
        version = mark_version_current(self.get_object(), request.user)
        return Response(self.get_serializer(version).data)
