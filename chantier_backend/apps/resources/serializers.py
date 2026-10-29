from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.resources.models import (
    Material,
    PurchaseOrder,
    PurchaseOrderLine,
    StockLocation,
    StockMovement,
    Supplier,
)
from rest_framework import serializers
from apps.resources.stock import stock_at
from decimal import Decimal


class MaterialSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Material
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class SupplierSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class PurchaseOrderSerializer(TenantOwnedModelSerializer):
    status = serializers.ChoiceField(choices=["draft", "sent", "partially_received", "received", "cancelled"], read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        current = self.instance.status if self.instance else PurchaseOrder.DRAFT
        if self.initial_data.get("status", current) != current:
            raise serializers.ValidationError({"status": "Utilisez les actions de changement de statut."})
        if self.instance and current != PurchaseOrder.DRAFT:
            raise serializers.ValidationError("Seule une commande brouillon peut etre modifiee.")
        return attrs
    class Meta:
        model = PurchaseOrder
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class PurchaseOrderLineSerializer(TenantOwnedModelSerializer):
    order_status = serializers.CharField(source="purchase_order.status", read_only=True)
    material_name = serializers.CharField(source="material.name", read_only=True)
    unit = serializers.CharField(source="material.unit", read_only=True)
    quantity = serializers.DecimalField(max_digits=18, decimal_places=3, min_value=Decimal("0.001"))
    unit_price = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal("0"))

    def validate(self, attrs):
        attrs = super().validate(attrs)
        order = attrs.get("purchase_order", getattr(self.instance, "purchase_order", None))
        if self.instance and order.pk != self.instance.purchase_order_id:
            raise serializers.ValidationError({"purchase_order": "Une ligne ne peut pas changer de commande."})
        if order.status != PurchaseOrder.DRAFT:
            raise serializers.ValidationError("Les lignes d'une commande envoyee ou finalisee sont verrouillees.")
        return attrs

    class Meta:
        model = PurchaseOrderLine
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class StockLocationSerializer(TenantOwnedModelSerializer):
    class Meta:
        model = StockLocation
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class StockMovementSerializer(TenantOwnedModelSerializer):
    movement_type = serializers.ChoiceField(choices=["in", "out", "transfer", "adjustment"])

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance:
            raise serializers.ValidationError("Les mouvements sont immuables. Enregistrez un mouvement inverse pour corriger le stock.")
        source, target = attrs.get("source_location"), attrs.get("target_location")
        kind = attrs["movement_type"]
        if attrs["quantity"] <= 0:
            raise serializers.ValidationError({"quantity": "La quantite doit etre strictement positive."})
        if kind in {"out", "transfer"} and not source:
            raise serializers.ValidationError({"source_location": "Un depot de depart est requis."})
        if kind in {"in", "transfer", "adjustment"} and not target:
            raise serializers.ValidationError({"target_location": "Un depot de destination est requis."})
        if kind in {"in", "adjustment"} and source:
            raise serializers.ValidationError({"source_location": "Une entree ne peut pas avoir de depot de depart."})
        if kind == "out" and target:
            raise serializers.ValidationError({"target_location": "Une sortie ne peut pas avoir de depot de destination."})
        if source and target and source.pk == target.pk:
            raise serializers.ValidationError("Les depots de depart et destination doivent etre distincts.")
        if source and stock_at(attrs["material"], source) < attrs["quantity"]:
            raise serializers.ValidationError({"quantity": "Stock insuffisant dans le depot de depart."})
        return attrs

    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
