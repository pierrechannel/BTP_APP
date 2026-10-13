from django.db import models

from apps.common.models import TenantOwnedModel


class Equipment(TenantOwnedModel):
    name = models.CharField(max_length=255)
    equipment_type = models.CharField(max_length=120)
    serial_number = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=80, blank=True)
    daily_cost = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")


class EquipmentAssignment(TenantOwnedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="assignments")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)


class MaintenancePlan(TenantOwnedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="maintenance_plans")
    name = models.CharField(max_length=255)
    interval_days = models.PositiveIntegerField(null=True, blank=True)
    interval_hours = models.PositiveIntegerField(null=True, blank=True)
    next_due_date = models.DateField(null=True, blank=True)


class MaintenanceRecord(TenantOwnedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="maintenance_records")
    maintenance_plan = models.ForeignKey(
        MaintenancePlan, null=True, blank=True, on_delete=models.SET_NULL
    )
    performed_at = models.DateField()
    description = models.TextField(blank=True)
    cost = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")


class UsageLog(TenantOwnedModel):
    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="usage_logs")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE)
    usage_date = models.DateField()
    hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    counter_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
