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
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.resources.stock import stock_at
from apps.resources.services import transition_purchase_order


class MaterialViewSet(TenantModelViewSet):
    queryset = Material.objects.select_related("tenant")
    serializer_class = MaterialSerializer
    filterset_fields = ["currency", "unit"]
    search_fields = ["reference", "name"]

    @action(detail=True, methods=["get"])
    def stock(self, request, pk=None):
        material = self.get_object()
        locations = StockLocation.objects.filter(tenant_id=request.tenant_id, deleted_at__isnull=True)
        project_id = request.query_params.get("project")
        if project_id:
            locations = locations.filter(project_id=project_id)
        return Response([{"location": location.pk, "name": location.name, "quantity": stock_at(material, location),
                          "unit": material.unit} for location in locations])


class SupplierViewSet(TenantModelViewSet):
    queryset = Supplier.objects.select_related("tenant")
    serializer_class = SupplierSerializer
    search_fields = ["name", "email", "phone"]


class PurchaseOrderViewSet(TenantModelViewSet):
    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        from apps.reports.business_pdf import purchase_order_pdf
        return purchase_order_pdf(request, self.get_object())

    queryset = PurchaseOrder.objects.select_related("project", "supplier", "tenant")
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["project", "supplier", "status", "ordered_at"]
    search_fields = ["order_number", "supplier__name"]

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        order = transition_purchase_order(self.get_object(), request.data.get("to_status"), request.user)
        return Response(self.get_serializer(order).data)


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
    http_method_names = ["get", "post", "head", "options"]
    queryset = StockMovement.objects.select_related(
        "material", "source_location", "target_location", "tenant"
    )
    serializer_class = StockMovementSerializer
    filterset_fields = ["material", "source_location", "target_location", "movement_type", "movement_date"]
