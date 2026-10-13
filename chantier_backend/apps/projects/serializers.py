from rest_framework import serializers

from apps.projects.models import Lot, Project, Stakeholder


class LotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lot
        fields = ["id", "project", "name", "code", "description", "subcontractor_name"]
        read_only_fields = ["id"]


class StakeholderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stakeholder
        fields = ["id", "project", "stakeholder_type", "name", "email", "phone", "notes"]
        read_only_fields = ["id"]


class ProjectSerializer(serializers.ModelSerializer):
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
        read_only_fields = ["id", "archived_at", "created_at", "updated_at", "version"]
