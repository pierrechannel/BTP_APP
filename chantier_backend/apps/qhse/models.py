from django.db import models

from apps.common.models import TenantOwnedModel


class Incident(TenantOwnedModel):
    DECLARED = "declared"
    ANALYSIS = "analysis"
    ACTIONS = "actions"
    CLOSED = "closed"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="incidents")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    occurred_at = models.DateTimeField()
    status = models.CharField(max_length=20, default=DECLARED)


class CorrectiveAction(TenantOwnedModel):
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="corrective_actions")
    title = models.CharField(max_length=255)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
