from rest_framework.routers import DefaultRouter

from apps.progress.views import DailyReportViewSet, PhotoViewSet, ProgressUpdateViewSet, SnagViewSet

router = DefaultRouter()
router.register("daily-reports", DailyReportViewSet, basename="daily-report")
router.register("photos", PhotoViewSet, basename="photo")
router.register("progress-updates", ProgressUpdateViewSet, basename="progress-update")
router.register("snags", SnagViewSet, basename="snag")

urlpatterns = router.urls
