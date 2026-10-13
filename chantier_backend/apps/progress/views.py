from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.progress.models import DailyReport, Photo, ProgressUpdate, Snag
from apps.progress.serializers import (
    DailyReportSerializer,
    PhotoSerializer,
    ProgressUpdateSerializer,
    SnagSerializer,
)
from apps.progress.services import resolve_snag, submit_daily_report, validate_daily_report


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


class ProgressUpdateViewSet(TenantModelViewSet):
    queryset = ProgressUpdate.objects.select_related("project", "task", "tenant")
    serializer_class = ProgressUpdateSerializer
    filterset_fields = ["project", "task", "update_date"]


class SnagViewSet(TenantModelViewSet):
    queryset = Snag.objects.select_related("project", "task", "tenant")
    serializer_class = SnagSerializer
    filterset_fields = ["project", "task", "status", "due_date"]
    search_fields = ["title", "description", "responsible_name"]

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        snag = resolve_snag(self.get_object(), request.user)
        return Response(self.get_serializer(snag).data)
