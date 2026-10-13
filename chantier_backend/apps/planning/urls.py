from rest_framework.routers import DefaultRouter

from apps.planning.views import TaskDependencyViewSet, TaskViewSet

router = DefaultRouter()
router.register("tasks", TaskViewSet, basename="task")
router.register("dependencies", TaskDependencyViewSet, basename="task-dependency")

urlpatterns = router.urls
