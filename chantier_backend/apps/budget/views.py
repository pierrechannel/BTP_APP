from rest_framework.decorators import action
from rest_framework.response import Response

from apps.budget.models import Budget, BudgetLine, Expense
from apps.budget.serializers import BudgetLineSerializer, BudgetSerializer, ExpenseSerializer
from apps.budget.services import get_budget_summary
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
