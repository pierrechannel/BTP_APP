from django.contrib import admin

from apps.progress.models import DailyReport, Photo, ProgressUpdate, Snag

admin.site.register(DailyReport)
admin.site.register(Photo)
admin.site.register(ProgressUpdate)
admin.site.register(Snag)
