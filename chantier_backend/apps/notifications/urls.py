from rest_framework.routers import DefaultRouter

from apps.notifications.views import MessageViewSet, NotificationViewSet

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")
router.register("messages", MessageViewSet, basename="message")

urlpatterns = router.urls
