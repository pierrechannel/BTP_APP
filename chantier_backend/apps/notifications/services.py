from django.utils import timezone

from apps.notifications.models import Notification


def mark_notification_read(notification: Notification, user) -> Notification:
    notification.read_at = timezone.now()
    notification.updated_by = user
    notification.version += 1
    notification.save(update_fields=["read_at", "updated_by", "version", "updated_at"])
    return notification
