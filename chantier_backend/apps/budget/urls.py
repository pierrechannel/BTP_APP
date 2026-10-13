from rest_framework.routers import DefaultRouter

from apps.budget.views import BudgetLineViewSet, BudgetViewSet, ExpenseViewSet

router = DefaultRouter()
router.register("budgets", BudgetViewSet, basename="budget")
router.register("budget-lines", BudgetLineViewSet, basename="budget-line")
router.register("expenses", ExpenseViewSet, basename="expense")

urlpatterns = router.urls
