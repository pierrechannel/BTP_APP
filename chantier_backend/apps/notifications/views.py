from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.notifications.models import Message, Notification
from apps.notifications.serializers import MessageSerializer, NotificationSerializer
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
