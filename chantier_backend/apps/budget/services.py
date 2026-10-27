from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from apps.budget.models import Budget, Expense, Invoice
from rest_framework.exceptions import ValidationError


def get_budget_summary(budget: Budget) -> dict:
    planned = budget.lines.filter(deleted_at__isnull=True).aggregate(total=Sum("amount"))["total"] or Decimal("0")
    spent = Expense.objects.filter(
        tenant=budget.tenant,
        budget_line__budget=budget,
        status__in=[Expense.VALIDATED, Expense.PAID],
        deleted_at__isnull=True, budget_line__deleted_at__isnull=True,
    ).aggregate(total=Sum("amount_including_tax"))["total"] or Decimal("0")
    return {
        "budget_id": str(budget.id),
        "currency": budget.currency,
        "planned": planned,
        "spent": spent,
        "remaining": planned - spent,
    }


@transaction.atomic
def validate_expense(expense: Expense, user) -> Expense:
    if expense.status in [Expense.VALIDATED, Expense.PAID]:
        return expense
    expense.status = Expense.VALIDATED
    expense.updated_by = user
    expense.version += 1
    expense.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return expense


def transition_invoice(invoice: Invoice, target: str, user) -> Invoice:
    allowed = {Invoice.DRAFT: {Invoice.VALIDATED, Invoice.REJECTED}, Invoice.VALIDATED: {Invoice.PAID}}
    if target not in allowed.get(invoice.status, set()):
        raise ValidationError("Transition de facture interdite.")
    invoice.status = target
    invoice.updated_by = user
    invoice.version += 1
    invoice.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return invoice
