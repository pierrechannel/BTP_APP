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
    details = models.JSONField("Lignes de dépense", default=list, blank=True)
    amount_excluding_tax = models.DecimalField(max_digits=18, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    amount_including_tax = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=20, default=DRAFT)


class Invoice(TenantOwnedModel):
    DRAFT = "draft"
    VALIDATED = "validated"
    PAID = "paid"
    REJECTED = "rejected"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="invoices")
    invoice_number = models.CharField(max_length=80)
    supplier_name = models.CharField(max_length=255, blank=True)
    issue_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    amount_excluding_tax = models.DecimalField(max_digits=18, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    amount_including_tax = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=20, default=DRAFT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "invoice_number"], name="unique_invoice_per_tenant")
        ]


class Amendment(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="amendments")
    reference = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "reference"], name="unique_amendment_per_tenant")
        ]


class ExchangeRate(TenantOwnedModel):
    base_currency = models.CharField(max_length=3)
    target_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=18, decimal_places=8)
    rate_date = models.DateField()
    source = models.CharField(max_length=120, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "base_currency", "target_currency", "rate_date"],
                name="unique_exchange_rate_per_day",
            )
        ]
