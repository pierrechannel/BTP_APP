from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.progress.models import DailyReport, Photo, ProgressUpdate, Snag
from rest_framework import serializers


class DailyReportSerializer(TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status == DailyReport.VALIDATED:
            raise serializers.ValidationError("Un rapport valide ne peut plus etre modifie.")
        return attrs

    class Meta:
        model = DailyReport
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status"]


class PhotoSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Photo
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ProgressUpdateSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = ProgressUpdate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class SnagSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Snag
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
