from rest_framework.routers import DefaultRouter
from django.urls import path
from apps.projects.dashboard import DashboardView

from apps.projects.views import LotViewSet, ProjectViewSet, StakeholderViewSet

router = DefaultRouter()
router.register("lots", LotViewSet, basename="lot")
router.register("stakeholders", StakeholderViewSet, basename="stakeholder")
router.register("", ProjectViewSet, basename="project")

urlpatterns = [path("dashboard/", DashboardView.as_view(), name="workspace-dashboard")] + router.urls
