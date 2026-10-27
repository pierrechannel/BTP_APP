from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.reports.models import KpiSnapshot, ReportRun, ReportTemplate
from rest_framework import serializers


class ReportTemplateSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = ReportTemplate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ReportRunSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance:
            raise serializers.ValidationError("Une execution de rapport est immuable.")
        return attrs

    class Meta:
        model = ReportRun
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "result_file"]


class KpiSnapshotSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = KpiSnapshot
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
