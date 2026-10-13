from rest_framework.routers import DefaultRouter

from apps.workforce.views import TimeEntryViewSet, WorkerViewSet

router = DefaultRouter()
router.register("workers", WorkerViewSet, basename="worker")
router.register("time-entries", TimeEntryViewSet, basename="time-entry")

urlpatterns = router.urls
