from django.contrib import admin

from apps.reports.models import ReportRun, ReportTemplate

admin.site.register(ReportTemplate)
admin.site.register(ReportRun)
