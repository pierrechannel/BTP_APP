from rest_framework.routers import DefaultRouter

from apps.qhse.views import CorrectiveActionViewSet, IncidentViewSet

router = DefaultRouter()
router.register("incidents", IncidentViewSet, basename="incident")
router.register("corrective-actions", CorrectiveActionViewSet, basename="corrective-action")

urlpatterns = router.urls
