from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.equipment.models import (
    Equipment,
    EquipmentAssignment,
    MaintenancePlan,
    MaintenanceRecord,
    UsageLog,
)
from rest_framework import serializers


class EquipmentSerializer(TenantOwnedModelSerializer):
    state = serializers.ChoiceField(choices=["operationnel", "maintenance", "en_panne", "hors_service"], default="operationnel")
    class Meta:
        model = Equipment
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class EquipmentAssignmentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = EquipmentAssignment
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class MaintenancePlanSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = MaintenancePlan
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class MaintenanceRecordSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = MaintenanceRecord
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class UsageLogSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = UsageLog
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
