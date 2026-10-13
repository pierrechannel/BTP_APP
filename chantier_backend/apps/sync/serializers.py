from rest_framework import serializers

from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS
from apps.sync.models import SyncMutation


class SyncMutationSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncMutation
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
