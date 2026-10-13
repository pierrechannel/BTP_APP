from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from apps.budget.models import Budget, Expense


def get_budget_summary(budget: Budget) -> dict:
    planned = budget.lines.aggregate(total=Sum("amount"))["total"] or Decimal("0")
    spent = Expense.objects.filter(
        tenant=budget.tenant,
        budget_line__budget=budget,
        status__in=[Expense.VALIDATED, Expense.PAID],
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
