from apps.common.viewsets import TenantModelViewSet
from apps.resources.models import (
    Material,
    PurchaseOrder,
    PurchaseOrderLine,
    StockLocation,
    StockMovement,
    Supplier,
)
from apps.resources.serializers import (
    MaterialSerializer,
    PurchaseOrderLineSerializer,
    PurchaseOrderSerializer,
    StockLocationSerializer,
    StockMovementSerializer,
    SupplierSerializer,
)


class MaterialViewSet(TenantModelViewSet):
    queryset = Material.objects.select_related("tenant")
    serializer_class = MaterialSerializer
    filterset_fields = ["currency", "unit"]
    search_fields = ["reference", "name"]


class SupplierViewSet(TenantModelViewSet):
    queryset = Supplier.objects.select_related("tenant")
    serializer_class = SupplierSerializer
    search_fields = ["name", "email", "phone"]


class PurchaseOrderViewSet(TenantModelViewSet):
    queryset = PurchaseOrder.objects.select_related("project", "supplier", "tenant")
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["project", "supplier", "status", "ordered_at"]
    search_fields = ["order_number", "supplier__name"]


class PurchaseOrderLineViewSet(TenantModelViewSet):
    queryset = PurchaseOrderLine.objects.select_related("purchase_order", "material", "tenant")
    serializer_class = PurchaseOrderLineSerializer
    filterset_fields = ["purchase_order", "material", "currency"]


class StockLocationViewSet(TenantModelViewSet):
    queryset = StockLocation.objects.select_related("project", "tenant")
    serializer_class = StockLocationSerializer
    filterset_fields = ["project", "code"]
    search_fields = ["name", "code"]


class StockMovementViewSet(TenantModelViewSet):
    queryset = StockMovement.objects.select_related(
        "material", "source_location", "target_location", "tenant"
    )
    serializer_class = StockMovementSerializer
    filterset_fields = ["material", "source_location", "target_location", "movement_type", "movement_date"]
