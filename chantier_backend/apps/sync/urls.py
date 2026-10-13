from rest_framework.routers import DefaultRouter

from apps.sync.views import SyncMutationViewSet

router = DefaultRouter()
router.register("mutations", SyncMutationViewSet, basename="sync-mutation")

urlpatterns = router.urls
