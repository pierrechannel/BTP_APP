from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.notifications.models import Channel, Message, Notification, NotificationPreference


class NotificationSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Notification
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class MessageSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Message
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class NotificationPreferenceSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ChannelSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Channel
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
