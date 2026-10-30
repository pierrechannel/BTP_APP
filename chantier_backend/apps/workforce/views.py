from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.workforce.models import Assignment, Certification, TimeEntry, Worker, WorkerCertification
from apps.workforce.serializers import (
    AssignmentSerializer,
    CertificationSerializer,
    TimeEntrySerializer,
    WorkerCertificationSerializer,
    WorkerSerializer,
)
from apps.workforce.services import validate_time_entry


class WorkerViewSet(TenantModelViewSet):
    @action(detail=False, methods=["get"], url_path="attendance-pdf")
    def attendance_pdf(self, request):
        from apps.reports.business_pdf import attendance_pdf
        return attendance_pdf(request, self.filter_queryset(self.get_queryset()).order_by("last_name", "first_name"))

    @action(detail=True, methods=["get"], url_path="attendance-pdf")
    def worker_attendance_pdf(self, request, pk=None):
        from apps.reports.business_pdf import attendance_pdf
        return attendance_pdf(request, [self.get_object()])

    queryset = Worker.objects.select_related("tenant")
    serializer_class = WorkerSerializer
    filterset_fields = ["currency", "job_title"]
    search_fields = ["first_name", "last_name", "job_title"]


class TimeEntryViewSet(TenantModelViewSet):
    permission_action_map = {**TenantModelViewSet.permission_action_map, 'sheet': 'read', 'save_sheet': 'create'}

    @action(detail=False, methods=['get'], url_path='sheet')
    def sheet(self, request):
        from apps.workforce.attendance_sheet import read_sheet
        return Response(read_sheet(request))

    @action(detail=False, methods=['post'], url_path='save-sheet')
    def save_sheet(self, request):
        from apps.workforce.attendance_sheet import save_sheet
        return Response(save_sheet(self, request))

    queryset = TimeEntry.objects.select_related("worker", "project", "task", "tenant")
    serializer_class = TimeEntrySerializer
    filterset_fields = ["worker", "project", "task", "work_date", "is_validated"]

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        time_entry = validate_time_entry(self.get_object(), request.user)
        return Response(self.get_serializer(time_entry).data)


class CertificationViewSet(TenantModelViewSet):
    queryset = Certification.objects.select_related("tenant")
    serializer_class = CertificationSerializer
    search_fields = ["code", "name"]


class WorkerCertificationViewSet(TenantModelViewSet):
    queryset = WorkerCertification.objects.select_related("worker", "certification", "tenant")
    serializer_class = WorkerCertificationSerializer
    filterset_fields = ["worker", "certification", "expires_at"]


class AssignmentViewSet(TenantModelViewSet):
    queryset = Assignment.objects.select_related("worker", "project", "task", "tenant")
    serializer_class = AssignmentSerializer
    filterset_fields = ["worker", "project", "task", "start_date", "end_date"]
