from django.db import models

from apps.common.models import TenantOwnedModel


class Worker(TenantOwnedModel):
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    job_title = models.CharField(max_length=120, blank=True)
    hourly_rate = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")


class TimeEntry(TenantOwnedModel):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="time_entries")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE)
    task = models.ForeignKey("planning.Task", null=True, blank=True, on_delete=models.SET_NULL)
    work_date = models.DateField()
    normal_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_validated = models.BooleanField(default=False)
