from django.contrib import admin

from apps.budget.models import Budget, BudgetLine, Expense

admin.site.register(Budget)
admin.site.register(BudgetLine)
admin.site.register(Expense)
