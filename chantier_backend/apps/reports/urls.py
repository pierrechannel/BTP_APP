from rest_framework.routers import DefaultRouter

from apps.reports.views import KpiSnapshotViewSet, ReportRunViewSet, ReportTemplateViewSet

router = DefaultRouter()
router.register("templates", ReportTemplateViewSet, basename="report-template")
router.register("runs", ReportRunViewSet, basename="report-run")
router.register("kpi-snapshots", KpiSnapshotViewSet, basename="kpi-snapshot")

urlpatterns = router.urls
