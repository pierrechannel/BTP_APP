from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.documents.models import ApprovalWorkflow, Document, DocumentAcl, DocumentVersion, Folder
from apps.documents.serializers import (
    ApprovalWorkflowSerializer,
    DocumentAclSerializer,
    DocumentSerializer,
    DocumentVersionSerializer,
    FolderSerializer,
)
from apps.documents.services import approve_document, decide_workflow, mark_version_current


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

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        document = approve_document(self.get_object(), request.user)
        return Response(self.get_serializer(document).data)


class DocumentVersionViewSet(TenantModelViewSet):
    queryset = DocumentVersion.objects.select_related("document", "tenant")
    serializer_class = DocumentVersionSerializer
    filterset_fields = ["document", "version_label", "is_current", "mime_type"]
    search_fields = ["original_name", "version_label"]

    @action(detail=True, methods=["post"], url_path="mark-current")
    def mark_current(self, request, pk=None):
        version = mark_version_current(self.get_object(), request.user)
        return Response(self.get_serializer(version).data)


class DocumentAclViewSet(TenantModelViewSet):
    queryset = DocumentAcl.objects.select_related("document", "role", "user", "tenant")
    serializer_class = DocumentAclSerializer
    filterset_fields = ["document", "role", "user", "permission"]


class ApprovalWorkflowViewSet(TenantModelViewSet):
    queryset = ApprovalWorkflow.objects.select_related("document", "requested_by", "reviewer", "tenant")
    serializer_class = ApprovalWorkflowSerializer
    filterset_fields = ["document", "requested_by", "reviewer", "status"]

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        workflow = decide_workflow(self.get_object(), ApprovalWorkflow.APPROVED, request.user, request.data.get("comment", ""))
        return Response(self.get_serializer(workflow).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        workflow = decide_workflow(self.get_object(), ApprovalWorkflow.REJECTED, request.user, request.data.get("comment", ""))
        return Response(self.get_serializer(workflow).data)
