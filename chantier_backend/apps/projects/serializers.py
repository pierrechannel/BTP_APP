from rest_framework import serializers

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.projects.models import Lot, Project, Stakeholder


class LotSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Lot
        fields = ["id", "project", "name", "code", "description", "subcontractor_name"]
        read_only_fields = ["id"]


class StakeholderSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Stakeholder
        fields = ["id", "project", "stakeholder_type", "name", "email", "phone", "notes"]
        read_only_fields = ["id"]


class ProjectSerializer(TenantOwnedModelSerializer):
    lots_count = serializers.IntegerField(read_only=True)

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
