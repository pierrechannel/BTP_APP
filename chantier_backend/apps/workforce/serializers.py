from rest_framework import serializers

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.workforce.models import Assignment, Certification, TimeEntry, Worker, WorkerCertification


class WorkerSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Worker
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class TimeEntrySerializer(TenantOwnedModelSerializer):
    class Meta:
        model = TimeEntry
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS

    def validate(self, attrs):
        normal = attrs.get("normal_hours", getattr(self.instance, "normal_hours", 0))
        overtime = attrs.get("overtime_hours", getattr(self.instance, "overtime_hours", 0))
        if normal < 0 or overtime < 0:
            raise serializers.ValidationError("Les heures ne peuvent pas etre negatives.")
        return attrs


class CertificationSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Certification
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class WorkerCertificationSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = WorkerCertification
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class AssignmentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Assignment
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
