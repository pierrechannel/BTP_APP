from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.reports.models import KpiSnapshot, ReportRun, ReportTemplate


class ReportTemplateSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = ReportTemplate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ReportRunSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = ReportRun
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class KpiSnapshotSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = KpiSnapshot
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
