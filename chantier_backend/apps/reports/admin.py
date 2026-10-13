from django.contrib import admin

from apps.reports.models import KpiSnapshot, ReportRun, ReportTemplate

admin.site.register(ReportTemplate)
admin.site.register(ReportRun)
admin.site.register(KpiSnapshot)
