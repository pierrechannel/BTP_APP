from rest_framework.routers import DefaultRouter

from apps.notifications.views import (
    ChannelViewSet,
    MessageViewSet,
    NotificationPreferenceViewSet,
    NotificationViewSet,
)

router = DefaultRouter()
router.register("notifications", NotificationViewSet, basename="notification")
router.register("messages", MessageViewSet, basename="message")
router.register("preferences", NotificationPreferenceViewSet, basename="notification-preference")
router.register("channels", ChannelViewSet, basename="channel")

urlpatterns = router.urls
