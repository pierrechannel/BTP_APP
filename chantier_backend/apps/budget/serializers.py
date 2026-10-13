from apps.budget.models import Amendment, Budget, BudgetLine, ExchangeRate, Expense, Invoice
from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer


class BudgetSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Budget
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class BudgetLineSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = BudgetLine
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ExpenseSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class InvoiceSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class AmendmentSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Amendment
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class ExchangeRateSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
