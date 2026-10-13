from django.contrib import admin

from apps.notifications.models import Message, Notification

admin.site.register(Notification)
admin.site.register(Message)
