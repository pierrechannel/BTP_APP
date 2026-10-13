from django.contrib import admin

from apps.notifications.models import Channel, Message, Notification, NotificationPreference

admin.site.register(Notification)
admin.site.register(Message)
admin.site.register(NotificationPreference)
admin.site.register(Channel)
