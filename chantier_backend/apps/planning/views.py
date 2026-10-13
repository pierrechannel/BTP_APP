from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.planning.models import Task, TaskDependency
from apps.planning.serializers import TaskDependencySerializer, TaskSerializer
from apps.planning.services import update_task_progress


class TaskViewSet(TenantModelViewSet):
    queryset = Task.objects.select_related("project", "lot", "parent", "tenant")
    serializer_class = TaskSerializer
    filterset_fields = ["project", "lot", "status"]
    search_fields = ["name"]
    ordering_fields = ["planned_start_date", "planned_end_date", "progress_percent", "created_at"]

    @action(detail=True, methods=["post"], url_path="update-progress")
    def update_progress(self, request, pk=None):
        task = self.get_object()
        try:
            progress = int(request.data.get("progress_percent"))
            update_task_progress(task, progress, request.user)
        except (TypeError, ValueError) as exc:
            return Response(
                {"code": "invalid_progress", "message": str(exc), "details": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(self.get_serializer(task).data)


class TaskDependencyViewSet(TenantModelViewSet):
    queryset = TaskDependency.objects.select_related("predecessor", "successor", "tenant")
    serializer_class = TaskDependencySerializer
    filterset_fields = ["predecessor", "successor", "dependency_type"]
