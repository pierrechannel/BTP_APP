from rest_framework import serializers


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

        for field_name, value in attrs.items():
            related_tenant_id = getattr(value, "tenant_id", None)
            if related_tenant_id and str(related_tenant_id) != str(tenant_id):
                raise serializers.ValidationError(
                    {
                        field_name: "La ressource referencee n'appartient pas au tenant courant."
                    }
                )

            nested_tenant = getattr(value, "tenant", None)
            nested_tenant_id = getattr(nested_tenant, "id", None)
            if nested_tenant_id and str(nested_tenant_id) != str(tenant_id):
                raise serializers.ValidationError(
                    {
                        field_name: "La ressource referencee n'appartient pas au tenant courant."
                    }
                )

        return attrs


class TenantOwnedModelSerializer(TenantValidationMixin, serializers.ModelSerializer):
    pass
