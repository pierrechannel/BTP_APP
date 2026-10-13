from rest_framework.routers import DefaultRouter

from apps.workforce.views import (
    AssignmentViewSet,
    CertificationViewSet,
    TimeEntryViewSet,
    WorkerCertificationViewSet,
    WorkerViewSet,
)

router = DefaultRouter()
router.register("workers", WorkerViewSet, basename="worker")
router.register("time-entries", TimeEntryViewSet, basename="time-entry")
router.register("certifications", CertificationViewSet, basename="certification")
router.register("worker-certifications", WorkerCertificationViewSet, basename="worker-certification")
router.register("assignments", AssignmentViewSet, basename="assignment")

urlpatterns = router.urls
