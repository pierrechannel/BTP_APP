from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.documents.models import ApprovalWorkflow, Document, DocumentAcl, DocumentVersion, Folder
from rest_framework import serializers
from apps.accounts.models import Membership
from apps.documents.services import mark_version_current


class FolderSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        project = attrs.get("project", getattr(self.instance, "project", None))
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        if parent and parent.project_id != project.pk:
            raise serializers.ValidationError({"parent": "Le dossier parent doit appartenir au meme projet."})
        visited = {self.instance.pk} if self.instance else set()
        while parent:
            if parent.pk in visited:
                raise serializers.ValidationError({"parent": "Hierarchie circulaire interdite."})
            visited.add(parent.pk)
            parent = parent.parent
        if self.instance and project.pk != self.instance.project_id:
            raise serializers.ValidationError({"project": "Un dossier ne peut pas changer de projet."})
        return attrs

    class Meta:
        model = Folder
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class DocumentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status"]


class DocumentVersionSerializer(TenantOwnedModelSerializer):
    is_current = serializers.BooleanField(default=True)
    def create(self, validated_data):
        current = validated_data.pop("is_current", True)
        version = super().create({**validated_data, "is_current": False})
        return mark_version_current(version, validated_data.get("updated_by")) if current else version

    def update(self, instance, validated_data):
        current = validated_data.pop("is_current", False)
        if "is_current" in self.initial_data and not current:
            validated_data["is_current"] = False
        if "document" in validated_data and validated_data["document"].pk != instance.document_id:
            raise serializers.ValidationError({"document": "Une version ne peut pas changer de document."})
        instance = super().update(instance, validated_data)
        return mark_version_current(instance, validated_data.get("updated_by")) if current else instance

    class Meta:
        model = DocumentVersion
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class DocumentAclSerializer(TenantOwnedModelSerializer):
    permission = serializers.ChoiceField(choices=["read", "write", "approve"])

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = attrs.get("user", getattr(self.instance, "user", None))
        role = attrs.get("role", getattr(self.instance, "role", None))
        if bool(user) == bool(role):
            raise serializers.ValidationError("Indiquez soit un utilisateur, soit un role.")
        if user and not Membership.objects.filter(
            user=user, tenant_id=self.context["request"].tenant_id, is_active=True
        ).exists():
            raise serializers.ValidationError({"user": "Utilisateur non membre du tenant."})
        return attrs

    class Meta:
        model = DocumentAcl
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ApprovalWorkflowSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        reviewer = attrs.get("reviewer", getattr(self.instance, "reviewer", None))
        if not reviewer or not Membership.objects.filter(
            user=reviewer, tenant_id=self.context["request"].tenant_id, is_active=True
        ).exists():
            raise serializers.ValidationError({"reviewer": "Un reviseur membre du tenant est requis."})
        if self.instance and self.instance.status != ApprovalWorkflow.PENDING:
            raise serializers.ValidationError("Un workflow traite ne peut plus etre modifie.")
        return attrs

    def create(self, validated_data):
        return super().create({**validated_data, "requested_by": self.context["request"].user})

    class Meta:
        model = ApprovalWorkflow
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["requested_by", "status", "decided_at", "comment"]
