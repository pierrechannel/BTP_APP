from django.db import models

from apps.common.models import TenantOwnedModel


class Material(TenantOwnedModel):
    reference = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=30)
    unit_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")


class Supplier(TenantOwnedModel):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
