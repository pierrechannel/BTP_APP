from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.documents.models import ApprovalWorkflow, Document, DocumentAcl, DocumentVersion, Folder


class FolderSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Folder
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class DocumentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class DocumentVersionSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class DocumentAclSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = DocumentAcl
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ApprovalWorkflowSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = ApprovalWorkflow
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
