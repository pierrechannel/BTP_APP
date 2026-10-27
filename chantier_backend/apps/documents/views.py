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
from apps.documents.permissions import accessible_documents, require_document_access, is_document_admin
from rest_framework.exceptions import PermissionDenied
from django.http import FileResponse, Http404


class DocumentAccessMixin:
    def get_queryset(self):
        permission = "read" if self.request.method in {"GET", "HEAD", "OPTIONS"} else "write"
        if self.action in {"approve", "reject"}:
            permission = "approve"
        documents = accessible_documents(self.request, permission)
        queryset = super().get_queryset()
        if queryset.model is Document:
            return queryset.filter(pk__in=documents.values("pk"))
        return queryset.filter(document_id__in=documents.values("pk"))

    def check_document_input(self, serializer):
        document = serializer.validated_data.get("document")
        if document:
            require_document_access(self.request, document)

    def perform_create(self, serializer):
        self.check_document_input(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self.check_document_input(serializer)
        super().perform_update(serializer)


class FolderViewSet(TenantModelViewSet):
    queryset = Folder.objects.select_related("project", "parent", "tenant")
    serializer_class = FolderSerializer
    filterset_fields = ["project", "parent"]
    search_fields = ["name"]


class DocumentViewSet(DocumentAccessMixin, TenantModelViewSet):
    queryset = Document.objects.select_related("folder", "tenant")
    serializer_class = DocumentSerializer
    filterset_fields = ["folder", "status"]
    search_fields = ["title"]

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        document = approve_document(self.get_object(), request.user)
        return Response(self.get_serializer(document).data)


class DocumentVersionViewSet(DocumentAccessMixin, TenantModelViewSet):
    queryset = DocumentVersion.objects.select_related("document", "tenant")
    serializer_class = DocumentVersionSerializer
    filterset_fields = ["document", "version_label", "is_current", "mime_type"]
    search_fields = ["original_name", "version_label"]

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        version = self.get_object()
        if not version.file:
            raise Http404
        try:
            return FileResponse(version.file.open("rb"), as_attachment=True, filename=version.original_name)
        except FileNotFoundError as exc:
            raise Http404 from exc

    @action(detail=True, methods=["post"], url_path="mark-current")
    def mark_current(self, request, pk=None):
        version = mark_version_current(self.get_object(), request.user)
        return Response(self.get_serializer(version).data)


class DocumentAclViewSet(DocumentAccessMixin, TenantModelViewSet):
    queryset = DocumentAcl.objects.select_related("document", "role", "user", "tenant")
    serializer_class = DocumentAclSerializer
    filterset_fields = ["document", "role", "user", "permission"]

    def check_owner(self, document):
        if not is_document_admin(self.request) and document.created_by_id != self.request.user.pk:
            raise PermissionDenied("Seul le proprietaire peut gerer le partage du document.")

    def check_document_input(self, serializer):
        super().check_document_input(serializer)
        document = serializer.validated_data.get("document") or serializer.instance.document
        self.check_owner(document)
        if serializer.instance:
            self.check_owner(serializer.instance.document)

    def perform_destroy(self, instance):
        self.check_owner(instance.document)
        super().perform_destroy(instance)


class ApprovalWorkflowViewSet(DocumentAccessMixin, TenantModelViewSet):
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
