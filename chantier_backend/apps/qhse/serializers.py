from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.qhse.models import (
    CorrectiveAction,
    Incident,
    Inspection,
    InspectionItem,
    InspectionTemplate,
    Ppsps,
)


class IncidentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Incident
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class CorrectiveActionSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = CorrectiveAction
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class InspectionTemplateSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = InspectionTemplate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class InspectionSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Inspection
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class InspectionItemSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = InspectionItem
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class PpspsSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Ppsps
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
