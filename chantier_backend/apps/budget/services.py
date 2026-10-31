from decimal import Decimal
from django.db import transaction
from django.db.models import Sum
from rest_framework.exceptions import ValidationError
from apps.budget.models import Budget, Expense, Invoice


def get_budget_summary(budget: Budget) -> dict:
    planned = budget.lines.filter(deleted_at__isnull=True).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    entries = Expense.objects.filter(tenant=budget.tenant, budget_line__budget=budget, deleted_at__isnull=True, budget_line__deleted_at__isnull=True)
    def total(statuses):
        return entries.filter(status__in=statuses).aggregate(total=Sum('amount_including_tax'))['total'] or Decimal('0')
    spent = total([Expense.VALIDATED, Expense.PAID])
    committed = total([Expense.SUBMITTED])
    return {'budget_id': str(budget.id), 'currency': budget.currency, 'planned': planned,
        'spent': spent, 'committed': committed, 'paid': total([Expense.PAID]),
        'draft': total([Expense.DRAFT]), 'remaining': planned - spent,
        'available': planned - spent - committed}


def expense_remaining(expense):
    consumed = Expense.objects.filter(budget_line=expense.budget_line, deleted_at__isnull=True,
        status__in=[Expense.SUBMITTED, Expense.VALIDATED, Expense.PAID]).exclude(pk=expense.pk).aggregate(total=Sum('amount_including_tax'))['total'] or Decimal('0')
    return expense.budget_line.amount - consumed - expense.amount_including_tax


@transaction.atomic
def transition_expense(expense, target, user, allow_overrun=False):
    allowed = {Expense.DRAFT: {Expense.SUBMITTED, Expense.VALIDATED, Expense.REJECTED},
        Expense.SUBMITTED: {Expense.VALIDATED, Expense.REJECTED},
        Expense.REJECTED: {Expense.DRAFT}, Expense.VALIDATED: {Expense.PAID}}
    if target not in allowed.get(expense.status, set()):
        raise ValidationError('Transition de dépense interdite.')
    if expense.invoice_id and (expense.invoice.deleted_at or expense.invoice.status == Invoice.REJECTED):
        if target not in [Expense.DRAFT, Expense.REJECTED]:
            raise ValidationError('Retirez ou remplacez la facture supprimée ou rejetée avant de continuer.')
    if target == Expense.VALIDATED and expense_remaining(expense) < 0 and not allow_overrun:
        raise ValidationError({'code': 'budget_overrun', 'detail': 'Cette dépense dépasse le disponible du poste. Confirmez le dépassement.'})
    if target == Expense.PAID and expense.invoice_id:
        invoice = expense.invoice
        if invoice.status not in [Invoice.VALIDATED, Invoice.PAID]:
            raise ValidationError('Validez la facture liée avant de payer cette dépense.')
        if invoice.status != Invoice.PAID:
            invoice.status = Invoice.PAID
            invoice.updated_by = user
            invoice.version += 1
            invoice.save(update_fields=['status', 'updated_by', 'version', 'updated_at'])
    expense.status = target
    expense.updated_by = user
    expense.version += 1
    expense.save(update_fields=['status', 'updated_by', 'version', 'updated_at'])
    return expense


@transaction.atomic
def validate_expense(expense, user, allow_overrun=False):
    if expense.status in [Expense.VALIDATED, Expense.PAID]:
        return expense
    return transition_expense(expense, Expense.VALIDATED, user, allow_overrun)


@transaction.atomic
def transition_invoice(invoice: Invoice, target: str, user) -> Invoice:
    allowed = {Invoice.DRAFT: {Invoice.VALIDATED, Invoice.REJECTED}, Invoice.VALIDATED: {Invoice.PAID}}
    if target not in allowed.get(invoice.status, set()):
        raise ValidationError('Transition de facture interdite.')
    expense = Expense.objects.filter(invoice=invoice, deleted_at__isnull=True).first()
    if expense and target == Invoice.PAID and expense.status != Expense.VALIDATED:
        raise ValidationError('Validez la dépense liée avant de payer cette facture.')
    if expense and target == Invoice.REJECTED and expense.status in [Expense.VALIDATED, Expense.PAID]:
        raise ValidationError('Une dépense validée est liée à cette facture.')
    invoice.status = target
    invoice.updated_by = user
    invoice.version += 1
    invoice.save(update_fields=['status', 'updated_by', 'version', 'updated_at'])
    if expense and target == Invoice.PAID:
        transition_expense(expense, Expense.PAID, user)
    return invoice
