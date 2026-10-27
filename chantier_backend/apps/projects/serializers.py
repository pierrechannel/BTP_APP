from rest_framework import serializers

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.projects.models import Lot, Project, Stakeholder


class LotSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Lot
        fields = ["id", "version", "project", "name", "code", "description", "subcontractor_name"]
        read_only_fields = ["id", "version"]


class StakeholderSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Stakeholder
        fields = ["id", "version", "project", "stakeholder_type", "name", "email", "phone", "notes"]
        read_only_fields = ["id", "version"]


class ProjectSerializer(TenantOwnedModelSerializer):
    lots_count = serializers.IntegerField(read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("planned_start_date", getattr(self.instance, "planned_start_date", None))
        end = attrs.get("planned_end_date", getattr(self.instance, "planned_end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"planned_end_date": "La fin doit suivre le debut."})
        if self.instance and "status" in attrs and attrs["status"] != self.instance.status:
            raise serializers.ValidationError({"status": "Utilisez l'action transition-status."})
        return attrs

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "code",
            "address",
            "latitude",
            "longitude",
            "client_name",
            "planned_start_date",
            "planned_end_date",
            "work_type",
            "contract_amount",
            "currency",
            "status",
            "archived_at",
            "lots_count",
            "created_at",
            "updated_at",
            "version",
        ]
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["archived_at"]
