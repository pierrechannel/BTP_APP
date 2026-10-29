from apps.budget.models import Amendment, Budget, BudgetLine, ExchangeRate, Expense, Invoice
from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from rest_framework import serializers
from decimal import Decimal
from django.db.models import Sum


class BudgetSerializer(TenantOwnedModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if (self.instance and attrs.get("currency", self.instance.currency) != self.instance.currency
                and self.instance.lines.exists()):
            raise serializers.ValidationError({"currency": "La devise d'un budget avec des lignes ne peut pas changer."})
        return attrs

    class Meta:
        model = Budget
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class BudgetLineSerializer(TenantOwnedModelSerializer):
    project_name = serializers.CharField(source="budget.project.name", read_only=True)
    lot_name = serializers.CharField(source="lot.name", read_only=True, allow_null=True)
    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()

    def get_spent(self, instance):
        if not hasattr(instance, "_spent_total"):
            instance._spent_total = instance.expenses.filter(
                tenant_id=instance.tenant_id, deleted_at__isnull=True,
                status__in=[Expense.VALIDATED, Expense.PAID],
            ).aggregate(total=Sum("amount_including_tax"))["total"] or Decimal("0")
        return format(instance._spent_total, ".2f")

    def get_remaining(self, instance):
        return format(instance.amount - Decimal(self.get_spent(instance)), ".2f")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        budget = attrs.get("budget", getattr(self.instance, "budget", None))
        lot = attrs.get("lot", getattr(self.instance, "lot", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", "BIF"))
        if lot and lot.project_id != budget.project_id:
            raise serializers.ValidationError({"lot": "Le lot doit appartenir au chantier du budget."})
        if currency != budget.currency:
            raise serializers.ValidationError({"currency": "La devise doit correspondre au budget."})
        if (self.instance and currency != self.instance.currency
                and self.instance.expenses.exists()):
            raise serializers.ValidationError({"currency": "La devise d'une ligne avec des depenses ne peut pas changer."})
        if attrs.get("amount", Decimal("0")) < 0:
            raise serializers.ValidationError({"amount": "Le montant ne peut pas etre negatif."})
        return attrs

    class Meta:
        model = BudgetLine
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class FinancialTotalsMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and self.instance.status in {"validated", "paid"}:
            raise serializers.ValidationError("Une piece validee ou payee ne peut plus etre modifiee.")
        amount = attrs.get("amount_excluding_tax", getattr(self.instance, "amount_excluding_tax", Decimal("0")))
        tax = attrs.get("tax_amount", getattr(self.instance, "tax_amount", Decimal("0")))
        if amount < 0 or tax < 0:
            raise serializers.ValidationError("Les montants ne peuvent pas etre negatifs.")
        attrs["amount_including_tax"] = amount + tax
        return attrs


class ExpenseSerializer(FinancialTotalsMixin, TenantOwnedModelSerializer):
    def validate(self, attrs):
        attrs = super().validate(attrs)
        line = attrs.get("budget_line", getattr(self.instance, "budget_line", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        if currency != line.currency:
            raise serializers.ValidationError({"currency": "La devise doit correspondre a la ligne budgetaire."})
        return attrs

    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "amount_including_tax"]


class InvoiceSerializer(FinancialTotalsMixin, TenantOwnedModelSerializer):
    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "amount_including_tax"]


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
