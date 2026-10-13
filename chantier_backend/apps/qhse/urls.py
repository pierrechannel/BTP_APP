from rest_framework.routers import DefaultRouter

from apps.qhse.views import (
    CorrectiveActionViewSet,
    IncidentViewSet,
    InspectionItemViewSet,
    InspectionTemplateViewSet,
    InspectionViewSet,
    PpspsViewSet,
)

router = DefaultRouter()
router.register("incidents", IncidentViewSet, basename="incident")
router.register("corrective-actions", CorrectiveActionViewSet, basename="corrective-action")
router.register("inspection-templates", InspectionTemplateViewSet, basename="inspection-template")
router.register("inspections", InspectionViewSet, basename="inspection")
router.register("inspection-items", InspectionItemViewSet, basename="inspection-item")
router.register("ppsps", PpspsViewSet, basename="ppsps")

urlpatterns = router.urls
