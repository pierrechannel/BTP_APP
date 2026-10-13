from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.notifications.models import Channel, Message, Notification, NotificationPreference
from apps.notifications.serializers import (
    ChannelSerializer,
    MessageSerializer,
    NotificationPreferenceSerializer,
    NotificationSerializer,
)
from apps.notifications.services import mark_notification_read


class NotificationViewSet(TenantModelViewSet):
    queryset = Notification.objects.select_related("user", "tenant")
    serializer_class = NotificationSerializer
    filterset_fields = ["user", "read_at"]
    search_fields = ["title", "body"]

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = mark_notification_read(self.get_object(), request.user)
        return Response(self.get_serializer(notification).data)


class MessageViewSet(TenantModelViewSet):
    queryset = Message.objects.select_related("project", "sender", "tenant")
    serializer_class = MessageSerializer
    filterset_fields = ["project", "sender"]
    search_fields = ["body"]


class NotificationPreferenceViewSet(TenantModelViewSet):
    queryset = NotificationPreference.objects.select_related("user", "tenant")
    serializer_class = NotificationPreferenceSerializer
    filterset_fields = ["user", "event_type", "email_enabled", "push_enabled", "in_app_enabled"]


class ChannelViewSet(TenantModelViewSet):
    queryset = Channel.objects.select_related("project", "tenant")
    serializer_class = ChannelSerializer
    filterset_fields = ["project"]
    search_fields = ["name", "description"]
