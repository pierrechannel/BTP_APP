from rest_framework.routers import DefaultRouter

from apps.reports.views import ReportRunViewSet, ReportTemplateViewSet

router = DefaultRouter()
router.register("templates", ReportTemplateViewSet, basename="report-template")
router.register("runs", ReportRunViewSet, basename="report-run")

urlpatterns = router.urls
