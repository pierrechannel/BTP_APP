from rest_framework.routers import DefaultRouter

from apps.resources.views import MaterialViewSet, SupplierViewSet

router = DefaultRouter()
router.register("materials", MaterialViewSet, basename="material")
router.register("suppliers", SupplierViewSet, basename="supplier")

urlpatterns = router.urls
