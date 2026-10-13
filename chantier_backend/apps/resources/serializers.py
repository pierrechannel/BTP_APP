from apps.common.serializers import TENANT_OWNED_READ_ONLY_FIELDS, TenantOwnedModelSerializer
from apps.resources.models import (
    Material,
    PurchaseOrder,
    PurchaseOrderLine,
    StockLocation,
    StockMovement,
    Supplier,
)


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
    class Meta:
        model = PurchaseOrder
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS


class PurchaseOrderLineSerializer(TenantOwnedModelSerializer):
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
    class Meta:
        model = StockMovement
        fields = "__all__"
        read_only_fields = TENANT_OWNED_READ_ONLY_FIELDS
