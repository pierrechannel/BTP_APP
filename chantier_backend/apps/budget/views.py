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
from apps.budget.services import get_budget_summary, validate_expense
from apps.common.viewsets import TenantModelViewSet


class BudgetViewSet(TenantModelViewSet):
    queryset = Budget.objects.select_related("project", "tenant")
    serializer_class = BudgetSerializer
    filterset_fields = ["project", "currency"]

    @action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        return Response(get_budget_summary(self.get_object()))


class BudgetLineViewSet(TenantModelViewSet):
    queryset = BudgetLine.objects.select_related("budget", "lot", "tenant")
    serializer_class = BudgetLineSerializer
    filterset_fields = ["budget", "lot", "category", "currency"]
    search_fields = ["label", "category"]


class ExpenseViewSet(TenantModelViewSet):
    queryset = Expense.objects.select_related("budget_line", "tenant")
    serializer_class = ExpenseSerializer
    filterset_fields = ["budget_line", "status", "currency", "date"]
    search_fields = ["supplier_name"]

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        expense = validate_expense(self.get_object(), request.user)
        return Response(self.get_serializer(expense).data)


class InvoiceViewSet(TenantModelViewSet):
    queryset = Invoice.objects.select_related("project", "tenant")
    serializer_class = InvoiceSerializer
    filterset_fields = ["project", "status", "currency", "issue_date"]
    search_fields = ["invoice_number", "supplier_name"]


class AmendmentViewSet(TenantModelViewSet):
    queryset = Amendment.objects.select_related("project", "tenant")
    serializer_class = AmendmentSerializer
    filterset_fields = ["project", "currency", "approved_at"]
    search_fields = ["reference", "description"]


class ExchangeRateViewSet(TenantModelViewSet):
    queryset = ExchangeRate.objects.select_related("tenant")
    serializer_class = ExchangeRateSerializer
    filterset_fields = ["base_currency", "target_currency", "rate_date"]
