from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/projects/", include("apps.projects.urls")),
    path("api/v1/planning/", include("apps.planning.urls")),
    path("api/v1/budget/", include("apps.budget.urls")),
    path("api/v1/resources/", include("apps.resources.urls")),
    path("api/v1/workforce/", include("apps.workforce.urls")),
    path("api/v1/equipment/", include("apps.equipment.urls")),
    path("api/v1/progress/", include("apps.progress.urls")),
    path("api/v1/qhse/", include("apps.qhse.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/sync/", include("apps.sync.urls")),
]
