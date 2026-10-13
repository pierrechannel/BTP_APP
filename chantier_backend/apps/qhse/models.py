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


class InspectionTemplate(TenantOwnedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=80)
    items = models.JSONField(default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="unique_inspection_template")
        ]


class Inspection(TenantOwnedModel):
    DRAFT = "draft"
    COMPLETED = "completed"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="inspections")
    template = models.ForeignKey(InspectionTemplate, on_delete=models.PROTECT)
    inspection_date = models.DateField()
    status = models.CharField(max_length=20, default=DRAFT)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)


class InspectionItem(TenantOwnedModel):
    inspection = models.ForeignKey(Inspection, on_delete=models.CASCADE, related_name="inspection_items")
    label = models.CharField(max_length=255)
    is_compliant = models.BooleanField(default=False)
    comment = models.TextField(blank=True)


class Ppsps(TenantOwnedModel):
    project = models.OneToOneField("projects.Project", on_delete=models.CASCADE, related_name="ppsps")
    reference = models.CharField(max_length=80)
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
