from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.equipment.models import (
    Equipment,
    EquipmentAssignment,
    MaintenancePlan,
    MaintenanceRecord,
    UsageLog,
)


class EquipmentSerializer(TenantOwnedModelSerializer):
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
