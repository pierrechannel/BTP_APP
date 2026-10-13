from django.contrib import admin

from apps.progress.models import DailyReport, Photo

admin.site.register(DailyReport)
admin.site.register(Photo)
