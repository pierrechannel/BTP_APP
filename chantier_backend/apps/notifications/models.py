from django.conf import settings
from django.db import models

from apps.common.models import TenantOwnedModel


class Notification(TenantOwnedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    read_at = models.DateTimeField(null=True, blank=True)


class Message(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    body = models.TextField()


class NotificationPreference(TenantOwnedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preferences")
    event_type = models.CharField(max_length=120)
    email_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "user", "event_type"], name="unique_notification_preference"
            )
        ]


class Channel(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
