from apps.budget.models import Amendment, Budget, BudgetLine, ExchangeRate, Expense, Invoice, ExpenseReceipt
from apps.budget.receipts import validate_receipt
from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from rest_framework import serializers
from decimal import Decimal, ROUND_HALF_UP
from django.db.models import Sum
from django.db import transaction


class BudgetSerializer(TenantOwnedModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    total_amount = serializers.SerializerMethodField()
    total_expenses_amount = serializers.SerializerMethodField()

    def get_total_expenses_amount(self, instance):
        total = getattr(instance, '_expenses_total', None)
        if total is None:
            total = Expense.objects.filter(budget_line__budget=instance, tenant_id=instance.tenant_id,
                deleted_at__isnull=True, budget_line__deleted_at__isnull=True,
                status__in=[Expense.VALIDATED, Expense.PAID]).aggregate(total=Sum('amount_including_tax'))['total'] or Decimal('0')
        return format(total, '.2f')

    def get_total_amount(self, instance):
        total = getattr(instance, '_planned_total', None)
        if total is None:
            total = instance.lines.filter(tenant_id=instance.tenant_id, deleted_at__isnull=True).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        return format(total, '.2f')

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance and attrs.get("project", self.instance.project) != self.instance.project and self.instance.lines.exists():
            raise serializers.ValidationError({"project": "Un budget avec des postes ne peut pas changer de chantier."})
        if (self.instance and attrs.get("currency", self.instance.currency) != self.instance.currency
                and self.instance.lines.exists()):
            raise serializers.ValidationError({"currency": "La devise d'un budget avec des lignes ne peut pas changer."})
        return attrs

    class Meta:
        model = Budget
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class BudgetLineSerializer(TenantOwnedModelSerializer):
    project = serializers.UUIDField(source="budget.project_id", read_only=True)
    project_name = serializers.CharField(source="budget.project.name", read_only=True)
    lot_name = serializers.CharField(source="lot.name", read_only=True, allow_null=True)
    spent = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    committed = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()

    def get_committed(self, instance):
        if not hasattr(instance, '_committed_total'):
            instance._committed_total = instance.expenses.filter(tenant_id=instance.tenant_id, deleted_at__isnull=True, status=Expense.SUBMITTED).aggregate(total=Sum('amount_including_tax'))['total'] or Decimal('0')
        return format(instance._committed_total, '.2f')

    def get_available(self, instance):
        return format(instance.amount - Decimal(self.get_spent(instance)) - Decimal(self.get_committed(instance)), '.2f')

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
        if self.instance and budget.pk != self.instance.budget_id and self.instance.expenses.exists():
            raise serializers.ValidationError({"budget": "Un poste avec des dépenses ne peut pas changer de budget."})
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
    receipts = serializers.SerializerMethodField()
    receipt_files = serializers.ListField(child=serializers.FileField(validators=[validate_receipt]), write_only=True, required=False, max_length=20)
    removed_receipts = serializers.ListField(child=serializers.UUIDField(), write_only=True, required=False, max_length=20)

    def get_receipts(self, instance):
        return list(instance.receipts.filter(deleted_at__isnull=True, tenant_id=instance.tenant_id).order_by('created_at').values('id', 'original_name', 'size'))

    def save_receipts(self, instance, files, removed):
        from django.utils import timezone
        from django.db import models
        user = self.context['request'].user
        instance.receipts.filter(pk__in=removed, tenant_id=instance.tenant_id).update(deleted_at=timezone.now(), updated_by=user, version=models.F('version') + 1)
        stored = []
        try:
            for file in files:
                receipt = ExpenseReceipt(tenant_id=instance.tenant_id, expense=instance, file=file,
                    original_name=file.name[:255], size=file.size, created_by=user, updated_by=user)
                stored.append(receipt)
                receipt.save()
        except Exception:
            for receipt in stored:
                if receipt.file and receipt.file._committed:
                    receipt.file.delete(save=False)
            raise
        return instance

    @transaction.atomic
    def create(self, validated_data):
        files = validated_data.pop('receipt_files', [])
        removed = validated_data.pop('removed_receipts', [])
        return self.save_receipts(super().create(validated_data), files, removed)

    @transaction.atomic
    def update(self, instance, validated_data):
        files = validated_data.pop('receipt_files', [])
        removed = validated_data.pop('removed_receipts', [])
        return self.save_receipts(super().update(instance, validated_data), files, removed)

    amount_excluding_tax = serializers.DecimalField(max_digits=18, decimal_places=2, required=False)
    def validate_details(self, value):
        if not isinstance(value, list) or len(value) > 500:
            raise serializers.ValidationError("Fournissez au maximum 500 lignes.")
        cleaned = []
        for row in value:
            try:
                label = str(row["label"]).strip()
                quantity = Decimal(str(row["quantity"]))
                price = Decimal(str(row["unit_price"]))
                if not label or len(label) > 255 or not quantity.is_finite() or not price.is_finite() or quantity <= 0 or price < 0:
                    raise ValueError()
                if quantity > Decimal("999999999") or price > Decimal("999999999"):
                    raise ValueError()
                if quantity.as_tuple().exponent < -3 or price.as_tuple().exponent < -2:
                    raise ValueError()
                cleaned.append({"label": label, "quantity": str(quantity), "unit_price": str(price)})
            except (KeyError, TypeError, ValueError, ArithmeticError):
                raise serializers.ValidationError("Chaque ligne exige un libellé, une quantité positive (3 décimales maximum) et un prix positif ou nul (2 décimales maximum).")
        return cleaned

    def validate(self, attrs):
        if self.instance and self.instance.status != Expense.DRAFT:
            raise serializers.ValidationError("Seule une dépense en brouillon peut être modifiée.")
        removed = set(attrs.get('removed_receipts', []))
        existing = set(self.instance.receipts.filter(deleted_at__isnull=True, tenant_id=self.instance.tenant_id).values_list('id', flat=True)) if self.instance else set()
        if not removed.issubset(existing):
            raise serializers.ValidationError({'removed_receipts': 'Un justificatif ne fait pas partie de cette dépense.'})
        if len(existing - removed) + len(attrs.get('receipt_files', [])) > 20:
            raise serializers.ValidationError({'receipt_files': 'Une dépense accepte au maximum 20 justificatifs.'})
        details = attrs.get("details", getattr(self.instance, "details", []))
        if details:
            attrs["amount_excluding_tax"] = sum((Decimal(row["quantity"]) * Decimal(row["unit_price"]) for row in details), Decimal("0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if attrs["amount_excluding_tax"] >= Decimal("10000000000000000"):
                raise serializers.ValidationError({"details": "Le total dépasse le montant autorisé."})
        elif not self.instance and "amount_excluding_tax" not in attrs:
            raise serializers.ValidationError({"amount_excluding_tax": "Renseignez un montant ou des lignes de détail."})
        attrs = super().validate(attrs)
        line = attrs.get("budget_line", getattr(self.instance, "budget_line", None))
        currency = attrs.get("currency", getattr(self.instance, "currency", None))
        if currency != line.currency:
            raise serializers.ValidationError({"currency": "La devise doit correspondre a la ligne budgetaire."})
        invoice = attrs.get("invoice", getattr(self.instance, "invoice", None))
        if invoice:
            if invoice.project_id != line.budget.project_id or invoice.currency != currency:
                raise serializers.ValidationError({"invoice": "La facture doit appartenir au même chantier et utiliser la même devise."})
            if invoice.amount_including_tax != attrs["amount_including_tax"]:
                raise serializers.ValidationError({"invoice": "Le TTC de la dépense doit correspondre à celui de la facture."})
            if invoice.status in [Invoice.PAID, Invoice.REJECTED]:
                raise serializers.ValidationError({"invoice": "Cette facture est déjà payée ou rejetée."})
        return attrs

    class Meta:
        model = Expense
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "amount_including_tax"]


class InvoiceSerializer(FinancialTotalsMixin, TenantOwnedModelSerializer):
    file = serializers.FileField(required=False, write_only=True, validators=[validate_receipt], label="Fichier de la facture")
    has_file = serializers.SerializerMethodField()

    def get_has_file(self, instance):
        return bool(instance.file)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if 'file' in attrs:
            if self.instance and self.instance.status != Invoice.DRAFT:
                raise serializers.ValidationError({'file': 'Le fichier ne peut être remplacé qu’en brouillon.'})
            attrs['original_name'] = attrs['file'].name[:255]
            attrs['file_size'] = attrs['file'].size
        if self.instance:
            expense = Expense.objects.filter(invoice=self.instance, deleted_at__isnull=True).first()
            if expense and (attrs["amount_including_tax"] != expense.amount_including_tax or attrs.get("currency", self.instance.currency) != expense.currency or attrs.get("project", self.instance.project).pk != expense.budget_line.budget.project_id):
                raise serializers.ValidationError("La facture doit rester cohérente avec sa dépense liée.")
        return attrs

    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS + ["status", "amount_including_tax", "original_name", "file_size"]


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
