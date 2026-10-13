from django.db import models

from apps.common.models import TenantOwnedModel


class DailyReport(TenantOwnedModel):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    VALIDATED = "validated"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="daily_reports")
    report_date = models.DateField()
    weather = models.CharField(max_length=120, blank=True)
    work_done = models.TextField(blank=True)
    difficulties = models.TextField(blank=True)
    status = models.CharField(max_length=20, default=DRAFT)


class Photo(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="photos")
    task = models.ForeignKey("planning.Task", null=True, blank=True, on_delete=models.SET_NULL)
    daily_report = models.ForeignKey(DailyReport, null=True, blank=True, on_delete=models.SET_NULL)
    image = models.ImageField(upload_to="progress/photos/")
    taken_at = models.DateTimeField(null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
