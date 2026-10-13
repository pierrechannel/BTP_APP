from django.db import models

from apps.common.models import TenantOwnedModel


class Budget(TenantOwnedModel):
    project = models.OneToOneField("projects.Project", on_delete=models.CASCADE, related_name="budget")
    currency = models.CharField(max_length=3, default="BIF")


class BudgetLine(TenantOwnedModel):
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name="lines")
    lot = models.ForeignKey("projects.Lot", null=True, blank=True, on_delete=models.SET_NULL)
    category = models.CharField(max_length=80)
    label = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="BIF")


class Expense(TenantOwnedModel):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    VALIDATED = "validated"
    PAID = "paid"
    REJECTED = "rejected"

    budget_line = models.ForeignKey(BudgetLine, on_delete=models.PROTECT, related_name="expenses")
    date = models.DateField()
    supplier_name = models.CharField(max_length=255, blank=True)
    amount_excluding_tax = models.DecimalField(max_digits=18, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    amount_including_tax = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=20, default=DRAFT)
