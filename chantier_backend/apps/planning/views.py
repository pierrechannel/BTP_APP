from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.planning.models import Task, TaskDependency
from apps.planning.serializers import TaskDependencySerializer, TaskSerializer


class TaskViewSet(TenantModelViewSet):
    queryset = Task.objects.select_related("project", "lot", "parent", "tenant")
    serializer_class = TaskSerializer
    filterset_fields = ["project", "lot", "status"]
    search_fields = ["name"]
    ordering_fields = ["planned_start_date", "planned_end_date", "progress_percent", "created_at"]

    @action(detail=True, methods=["post"], url_path="update-progress")
    def update_progress(self, request, pk=None):
        task = self.get_object()
        field = serializers.IntegerField(min_value=0, max_value=100)
        progress = field.run_validation(request.data.get("progress_percent"))
        serializer = self.get_serializer(task, data={"progress_percent": progress}, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)


class TaskDependencyViewSet(TenantModelViewSet):
    queryset = TaskDependency.objects.select_related("predecessor", "successor", "tenant")
    serializer_class = TaskDependencySerializer
    filterset_fields = ["predecessor", "successor", "dependency_type"]
