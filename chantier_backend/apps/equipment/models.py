from django.db import models

from apps.common.models import TenantOwnedModel


class Equipment(TenantOwnedModel):
    name = models.CharField(max_length=255)
    equipment_type = models.CharField(max_length=120)
    serial_number = models.CharField(max_length=120, blank=True)
    state = models.CharField(max_length=80, blank=True)
    daily_cost = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")
