from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.progress.models import DailyReport, Photo
from apps.progress.serializers import DailyReportSerializer, PhotoSerializer
from apps.progress.services import submit_daily_report, validate_daily_report


class DailyReportViewSet(TenantModelViewSet):
    queryset = DailyReport.objects.select_related("project", "tenant")
    serializer_class = DailyReportSerializer
    filterset_fields = ["project", "report_date", "status"]
    search_fields = ["weather", "work_done", "difficulties"]

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        report = submit_daily_report(self.get_object(), request.user)
        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        report = validate_daily_report(self.get_object(), request.user)
        return Response(self.get_serializer(report).data)


class PhotoViewSet(TenantModelViewSet):
    queryset = Photo.objects.select_related("project", "task", "daily_report", "tenant")
    serializer_class = PhotoSerializer
    filterset_fields = ["project", "task", "daily_report"]
