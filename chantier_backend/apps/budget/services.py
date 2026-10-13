from decimal import Decimal

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
