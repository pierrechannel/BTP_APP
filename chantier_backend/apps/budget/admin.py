from django.contrib import admin

from apps.budget.models import Amendment, Budget, BudgetLine, ExchangeRate, Expense, Invoice

admin.site.register(Budget)
admin.site.register(BudgetLine)
admin.site.register(Expense)
admin.site.register(Invoice)
admin.site.register(Amendment)
admin.site.register(ExchangeRate)
