from rest_framework.routers import DefaultRouter

from apps.resources.views import (
    MaterialViewSet,
    PurchaseOrderLineViewSet,
    PurchaseOrderViewSet,
    StockLocationViewSet,
    StockMovementViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("materials", MaterialViewSet, basename="material")
router.register("suppliers", SupplierViewSet, basename="supplier")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("purchase-order-lines", PurchaseOrderLineViewSet, basename="purchase-order-line")
router.register("stock-locations", StockLocationViewSet, basename="stock-location")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")

urlpatterns = router.urls
