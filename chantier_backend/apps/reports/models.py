from django.db import models

from apps.common.models import TenantOwnedModel


class ReportTemplate(TenantOwnedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=80)
    definition = models.JSONField(default=dict, blank=True)


class ReportRun(TenantOwnedModel):
    template = models.ForeignKey(ReportTemplate, on_delete=models.PROTECT, related_name="runs")
    status = models.CharField(max_length=40, default="pending")
    parameters = models.JSONField(default=dict, blank=True)
    result_file = models.FileField(upload_to="reports/", blank=True)
