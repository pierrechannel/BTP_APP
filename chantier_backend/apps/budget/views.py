from rest_framework.decorators import action
from rest_framework.response import Response

from apps.budget.models import Amendment, Budget, BudgetLine, ExchangeRate, Expense, Invoice
from apps.budget.serializers import (
    AmendmentSerializer,
    BudgetLineSerializer,
    BudgetSerializer,
    ExchangeRateSerializer,
    ExpenseSerializer,
    InvoiceSerializer,
)
from apps.budget.services import get_budget_summary, validate_expense, transition_invoice, transition_expense
from apps.common.viewsets import TenantModelViewSet
from django.db.models import DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
import django_filters


class ExpenseFilter(django_filters.FilterSet):
    budget = django_filters.UUIDFilter(field_name="budget_line__budget_id")

    class Meta:
        model = Expense
        fields = ["budget", "budget_line", "status", "currency", "date"]


class BudgetViewSet(TenantModelViewSet):
    queryset = Budget.objects.select_related("project", "tenant").annotate(
        _planned_total=Coalesce(Sum('lines__amount', filter=Q(
            lines__deleted_at__isnull=True, lines__tenant_id=F('tenant_id'),
        )), Value(0), output_field=DecimalField(max_digits=24, decimal_places=2)),
    )
    def get_queryset(self):
        from django.db.models import OuterRef, Subquery
        expenses = Expense.objects.filter(
            budget_line__budget_id=OuterRef('pk'), tenant_id=OuterRef('tenant_id'),
            deleted_at__isnull=True, budget_line__deleted_at__isnull=True,
            status__in=[Expense.VALIDATED, Expense.PAID],
        ).order_by().values('budget_line__budget_id').annotate(total=Sum('amount_including_tax')).values('total')
        return super().get_queryset().annotate(_expenses_total=Coalesce(
            Subquery(expenses, output_field=DecimalField(max_digits=24, decimal_places=2)),
            Value(0), output_field=DecimalField(max_digits=24, decimal_places=2),
        ))

    serializer_class = BudgetSerializer
    filterset_fields = ["project", "currency"]

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        return Response(get_budget_summary(self.get_object()))


class BudgetLineViewSet(TenantModelViewSet):
    queryset = BudgetLine.objects.select_related("budget__project", "lot", "tenant").annotate(
        _spent_total=Coalesce(Sum("expenses__amount_including_tax", filter=Q(
            expenses__deleted_at__isnull=True, expenses__status__in=[Expense.VALIDATED, Expense.PAID], expenses__tenant_id=F("tenant_id"),
        )), Value(0), output_field=DecimalField(max_digits=24, decimal_places=2)),
        _committed_total=Coalesce(Sum('expenses__amount_including_tax', filter=Q(
            expenses__deleted_at__isnull=True, expenses__status=Expense.SUBMITTED, expenses__tenant_id=F('tenant_id'),
        )), Value(0), output_field=DecimalField(max_digits=24, decimal_places=2)),
    )
    serializer_class = BudgetLineSerializer
    filterset_fields = ["budget", "lot", "category", "currency"]
    search_fields = ["label", "category"]


class ExpenseViewSet(TenantModelViewSet):
    queryset = Expense.objects.select_related("budget_line", "tenant")
    serializer_class = ExpenseSerializer
    filterset_fields = ["budget_line", "status", "currency", "date"]
    filterset_class = ExpenseFilter
    search_fields = ["supplier_name"]

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        expense = validate_expense(self.get_object(), request.user, request.data.get('allow_overrun') is True)
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return Response(self.get_serializer(transition_expense(self.get_object(), Expense.SUBMITTED, request.user)).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return Response(self.get_serializer(transition_expense(self.get_object(), Expense.REJECTED, request.user)).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        return Response(self.get_serializer(transition_expense(self.get_object(), Expense.DRAFT, request.user)).data)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        return Response(self.get_serializer(transition_expense(self.get_object(), Expense.PAID, request.user)).data)

    permission_action_map = {**TenantModelViewSet.permission_action_map, 'reopen': 'update', 'receipt_download': 'read'}

    @action(detail=True, methods=['get'], url_path=r'receipts/(?P<receipt_id>[^/.]+)/download')
    def receipt_download(self, request, pk=None, receipt_id=None):
        from django.http import FileResponse, Http404
        from django.shortcuts import get_object_or_404
        from uuid import UUID
        try:
            receipt_id = UUID(receipt_id)
        except (TypeError, ValueError) as exc:
            raise Http404 from exc
        expense = self.get_object()
        receipt = get_object_or_404(expense.receipts, pk=receipt_id, tenant_id=request.tenant_id, deleted_at__isnull=True)
        try:
            response = FileResponse(receipt.file.open('rb'), as_attachment=True, filename=receipt.original_name)
            response['X-Content-Type-Options'] = 'nosniff'
            response['Cache-Control'] = 'private, no-store'
            return response
        except FileNotFoundError as exc:
            raise Http404 from exc


class InvoiceViewSet(TenantModelViewSet):
    permission_action_map = {**TenantModelViewSet.permission_action_map, 'file_download': 'read'}

    @action(detail=True, methods=['get'], url_path='file/download')
    def file_download(self, request, pk=None):
        from django.http import FileResponse, Http404
        invoice = self.get_object()
        if not invoice.file:
            raise Http404
        try:
            response = FileResponse(invoice.file.open('rb'), as_attachment=True, filename=invoice.original_name)
            response['X-Content-Type-Options'] = 'nosniff'
            response['Cache-Control'] = 'private, no-store'
            return response
        except FileNotFoundError as exc:
            raise Http404 from exc
    queryset = Invoice.objects.select_related("project", "tenant")
    serializer_class = InvoiceSerializer
    filterset_fields = ["project", "status", "currency", "issue_date"]
    search_fields = ["invoice_number", "supplier_name"]

    def perform_destroy(self, instance):
        if Expense.objects.filter(invoice=instance, deleted_at__isnull=True).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Retirez le lien avec la dépense avant de supprimer cette facture.')
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        return Response(self.get_serializer(transition_invoice(self.get_object(), Invoice.VALIDATED, request.user)).data)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        return Response(self.get_serializer(transition_invoice(self.get_object(), Invoice.PAID, request.user)).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return Response(self.get_serializer(transition_invoice(self.get_object(), Invoice.REJECTED, request.user)).data)


class AmendmentViewSet(TenantModelViewSet):
    queryset = Amendment.objects.select_related("project", "tenant")
    serializer_class = AmendmentSerializer
    filterset_fields = ["project", "currency", "approved_at"]
    search_fields = ["reference", "description"]


class ExchangeRateViewSet(TenantModelViewSet):
    queryset = ExchangeRate.objects.select_related("tenant")
    serializer_class = ExchangeRateSerializer
    filterset_fields = ["base_currency", "target_currency", "rate_date"]
