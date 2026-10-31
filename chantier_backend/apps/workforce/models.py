from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models

from apps.common.models import TenantOwnedModel


class Worker(TenantOwnedModel):
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    job_title = models.CharField(max_length=120, blank=True)
    address = models.TextField("Adresse", blank=True)
    phone = models.CharField("Téléphone", max_length=40, blank=True)
    identity_type = models.CharField("Type de pièce d'identité", max_length=80, blank=True)
    identity_number = models.CharField("Numéro de pièce d'identité", max_length=120, blank=True)
    identity_document_front = models.FileField("Document d’identité — recto", upload_to="workforce/identity/", blank=True)
    identity_document_back = models.FileField("Document d’identité — verso", upload_to="workforce/identity/", blank=True)
    birth_date = models.DateField("Date de naissance", null=True, blank=True)
    payment_basis = models.CharField("Mode de rémunération", max_length=10, default="hourly",
        choices=[("hourly", "Horaire"), ("daily", "Journalier"), ("monthly", "Forfait mensuel")])
    daily_rate = models.DecimalField("Prix journalier", max_digits=18, decimal_places=2,
        null=True, blank=True, validators=[MinValueValidator(Decimal("0"))])
    monthly_rate = models.DecimalField("Forfait mensuel", max_digits=18, decimal_places=2,
        null=True, blank=True, validators=[MinValueValidator(Decimal("0"))])
    hourly_rate = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    currency = models.CharField(max_length=3, default="BIF")

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(hourly_rate__isnull=True) | models.Q(hourly_rate__gte=0),
                name="worker_rate_nonnegative",
            ),
        ]


class TimeEntry(TenantOwnedModel):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="time_entries")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE)
    task = models.ForeignKey("planning.Task", null=True, blank=True, on_delete=models.SET_NULL)
    work_date = models.DateField()
    normal_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    attendance_status = models.CharField(max_length=10, blank=True, choices=[("present", "Présent"), ("late", "Retard"), ("absent", "Absent")])
    arrival_time = models.TimeField(null=True, blank=True)
    departure_time = models.TimeField(null=True, blank=True)
    is_validated = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(normal_hours__gte=0, overtime_hours__gte=0),
                name="time_entry_hours_nonnegative",
            ),
            models.CheckConstraint(
                check=models.Q(normal_hours__lte=24 - models.F("overtime_hours")),
                name="time_entry_hours_lte_24",
            ),
        ]


class Certification(TenantOwnedModel):
    code = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="unique_certification_per_tenant")
        ]


class WorkerCertification(TenantOwnedModel):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="certifications")
    certification = models.ForeignKey(Certification, on_delete=models.PROTECT)
    issued_at = models.DateField(null=True, blank=True)
    expires_at = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["worker", "certification"], name="unique_worker_certification"
            ),
            models.CheckConstraint(
                check=(models.Q(issued_at__isnull=True) | models.Q(expires_at__isnull=True)
                       | models.Q(expires_at__gte=models.F("issued_at"))),
                name="worker_certification_dates_ordered",
            ),
        ]


class Assignment(TenantOwnedModel):
    worker = models.ForeignKey(Worker, on_delete=models.CASCADE, related_name="assignments")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE)
    task = models.ForeignKey("planning.Task", null=True, blank=True, on_delete=models.SET_NULL)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    role = models.CharField(max_length=120, blank=True)
