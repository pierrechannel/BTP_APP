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


class KpiSnapshot(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.CASCADE)
    snapshot_date = models.DateField()
    code = models.CharField(max_length=80)
    value = models.DecimalField(max_digits=18, decimal_places=4)
    unit = models.CharField(max_length=40, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "project", "snapshot_date", "code"], name="unique_kpi_snapshot"
            )
        ]
