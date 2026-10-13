from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.workforce.models import TimeEntry, Worker
from apps.workforce.serializers import TimeEntrySerializer, WorkerSerializer
from apps.workforce.services import validate_time_entry


class WorkerViewSet(TenantModelViewSet):
    queryset = Worker.objects.select_related("tenant")
    serializer_class = WorkerSerializer
    filterset_fields = ["currency", "job_title"]
    search_fields = ["first_name", "last_name", "job_title"]


class TimeEntryViewSet(TenantModelViewSet):
    queryset = TimeEntry.objects.select_related("worker", "project", "task", "tenant")
    serializer_class = TimeEntrySerializer
    filterset_fields = ["worker", "project", "task", "work_date", "is_validated"]

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        time_entry = validate_time_entry(self.get_object(), request.user)
        return Response(self.get_serializer(time_entry).data)
