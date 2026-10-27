from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.sync.models import SyncMutation
from rest_framework import serializers


class SyncMutationSerializer(TenantOwnedModelSerializer):
    operation = serializers.ChoiceField(choices=["create", "update", "upsert", "delete"])

    def validate(self, attrs):
        attrs = super().validate(attrs)
        device = attrs.get("device", getattr(self.instance, "device", None))
        request = self.context["request"]
        if device and (not device.is_active or device.user_id != request.user.pk):
            raise serializers.ValidationError({"device": "Cet appareil ne vous appartient pas ou est inactif."})
        if self.instance:
            raise serializers.ValidationError("Les mutations sont immuables ; creez une nouvelle mutation.")
        return attrs

    class Meta:
        model = SyncMutation
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "error"]
