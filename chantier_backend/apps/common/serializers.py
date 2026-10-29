from rest_framework import serializers

from apps.accounts.models import Membership, User
from apps.common.identifiers import AUTOMATIC_IDENTIFIERS

TENANT_OWNED_READ_ONLY_FIELDS = [
    "id",
    "tenant",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "deleted_at",
    "version",
]


class TenantValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        tenant_id = getattr(request, "tenant_id", None)
        if not tenant_id:
            return attrs

        values = dict(attrs)
        if self.instance:
            for field_name, field in self.fields.items():
                if not field.read_only and field_name not in values:
                    value = getattr(self.instance, field_name, None)
                    if hasattr(value, "_meta"):
                        values[field_name] = value
        for field_name, value in values.items():
            if isinstance(value, User) and self.Meta.model is not Membership:
                if not Membership.objects.filter(user=value, tenant_id=tenant_id, is_active=True).exists():
                    raise serializers.ValidationError({field_name: "Utilisateur non membre du tenant courant."})
            if getattr(value, "deleted_at", None):
                raise serializers.ValidationError({field_name: "Cette ressource a ete supprimee."})
            related_tenant_id = getattr(value, "tenant_id", None)
            if related_tenant_id and str(related_tenant_id) != str(tenant_id):
                raise serializers.ValidationError(
                    {
                        field_name: "La ressource referencee n'appartient pas au tenant courant."
                    }
                )

        project = attrs.get("project", getattr(self.instance, "project", None))
        if project:
            for field_name, value in values.items():
                related_project = getattr(value, "project_id", None)
                if related_project and related_project != project.pk:
                    raise serializers.ValidationError({field_name: "La ressource doit appartenir au meme chantier."})
        for start_name, end_name in [("start_date", "end_date"), ("issue_date", "due_date")]:
            start = attrs.get(start_name, getattr(self.instance, start_name, None))
            end = attrs.get(end_name, getattr(self.instance, end_name, None))
            if start and end and end < start:
                raise serializers.ValidationError({end_name: "La fin doit suivre le debut."})
        return attrs


class TenantOwnedModelSerializer(TenantValidationMixin, serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        identifier = AUTOMATIC_IDENTIFIERS.get(self.Meta.model._meta.label_lower)
        if identifier and identifier[0] in fields:
            field = fields[identifier[0]]
            field.read_only = True
            field.required = False
        return fields
