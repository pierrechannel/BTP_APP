from rest_framework.routers import DefaultRouter

from apps.budget.views import (
    AmendmentViewSet,
    BudgetLineViewSet,
    BudgetViewSet,
    ExchangeRateViewSet,
    ExpenseViewSet,
    InvoiceViewSet,
)

router = DefaultRouter()
router.register("budgets", BudgetViewSet, basename="budget")
router.register("budget-lines", BudgetLineViewSet, basename="budget-line")
router.register("expenses", ExpenseViewSet, basename="expense")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("amendments", AmendmentViewSet, basename="amendment")
router.register("exchange-rates", ExchangeRateViewSet, basename="exchange-rate")

urlpatterns = router.urls
