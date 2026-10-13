from rest_framework.routers import DefaultRouter

from apps.progress.views import DailyReportViewSet, PhotoViewSet

router = DefaultRouter()
router.register("daily-reports", DailyReportViewSet, basename="daily-report")
router.register("photos", PhotoViewSet, basename="photo")

urlpatterns = router.urls
