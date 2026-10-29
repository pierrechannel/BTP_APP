from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView

from apps.accounts.views import (
    AuditLogViewSet,
    DeviceViewSet,
    MembershipViewSet,
    MeView,
    DirectoryView,
    RoleDirectoryView,
    RoleViewSet,
    TenantViewSet,
    UserViewSet,
)
from apps.accounts.platform import PlatformOverviewView

urlpatterns = [
    path("platform/overview/", PlatformOverviewView.as_view(), name="platform-overview"),
    path("directory/", DirectoryView.as_view(), name="tenant-directory"),
    path("role-directory/", RoleDirectoryView.as_view(), name="tenant-role-directory"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("me/", MeView.as_view(), name="auth_me"),
]

router = DefaultRouter()
router.register("tenants", TenantViewSet, basename="tenant")
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("memberships", MembershipViewSet, basename="membership")
router.register("devices", DeviceViewSet, basename="device")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns += router.urls
