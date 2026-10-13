from django.db import models

from apps.common.models import TenantOwnedModel


class Project(TenantOwnedModel):
    STUDY = "study"
    PREPARATION = "preparation"
    IN_PROGRESS = "in_progress"
    SUSPENDED = "suspended"
    HANDOVER = "handover"
    CLOSED = "closed"

    STATUS_CHOICES = [
        (STUDY, "Etude"),
        (PREPARATION, "Preparation"),
        (IN_PROGRESS, "En cours"),
        (SUSPENDED, "Suspendu"),
        (HANDOVER, "Reception"),
        (CLOSED, "Cloture"),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    address = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    client_name = models.CharField(max_length=255, blank=True)
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    work_type = models.CharField(max_length=120, blank=True)
    contract_amount = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STUDY)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="unique_project_code_per_tenant")
        ]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "code"]),
        ]
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.code} - {self.name}"


class Lot(TenantOwnedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="lots")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    subcontractor_name = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["project", "code"], name="unique_lot_code_per_project")
        ]
        indexes = [models.Index(fields=["tenant", "project"])]
        ordering = ["project__name", "code"]

    def __str__(self) -> str:
        return f"{self.project.code} / {self.code}"


class Stakeholder(TenantOwnedModel):
    CLIENT = "client"
    ARCHITECT = "architect"
    CONTROL_OFFICE = "control_office"
    SPS = "sps"
    OTHER = "other"

    TYPE_CHOICES = [
        (CLIENT, "Client"),
        (ARCHITECT, "Maitre d'oeuvre"),
        (CONTROL_OFFICE, "Bureau de controle"),
        (SPS, "Coordonnateur SPS"),
        (OTHER, "Autre"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="stakeholders")
    stakeholder_type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["tenant", "project", "stakeholder_type"])]
        ordering = ["name"]


class ProjectStatusHistory(TenantOwnedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    changed_at = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-changed_at"]
