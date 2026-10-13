from rest_framework.routers import DefaultRouter

from apps.equipment.views import (
    EquipmentAssignmentViewSet,
    EquipmentViewSet,
    MaintenancePlanViewSet,
    MaintenanceRecordViewSet,
    UsageLogViewSet,
)

router = DefaultRouter()
router.register("equipment", EquipmentViewSet, basename="equipment")
router.register("assignments", EquipmentAssignmentViewSet, basename="equipment-assignment")
router.register("maintenance-plans", MaintenancePlanViewSet, basename="maintenance-plan")
router.register("maintenance-records", MaintenanceRecordViewSet, basename="maintenance-record")
router.register("usage-logs", UsageLogViewSet, basename="usage-log")

urlpatterns = router.urls
