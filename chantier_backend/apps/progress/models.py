from django.db import models

from apps.common.models import TenantOwnedModel


class DailyReport(TenantOwnedModel):
    workflow_history = models.JSONField(default=list, blank=True)
    correction_reason = models.TextField(blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey('accounts.User', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
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


class ProgressUpdate(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="progress_updates")
    task = models.ForeignKey("planning.Task", on_delete=models.CASCADE, related_name="progress_updates")
    progress_percent = models.PositiveSmallIntegerField(default=0)
    notes = models.TextField(blank=True)
    update_date = models.DateField()


class Snag(TenantOwnedModel):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="snags")
    task = models.ForeignKey("planning.Task", null=True, blank=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    responsible_name = models.CharField(max_length=255, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default=OPEN)
    resolved_at = models.DateTimeField(null=True, blank=True)
