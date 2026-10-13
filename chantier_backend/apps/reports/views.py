from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantModelViewSet
from apps.reports.models import KpiSnapshot, ReportRun, ReportTemplate
from apps.reports.serializers import KpiSnapshotSerializer, ReportRunSerializer, ReportTemplateSerializer
from apps.reports.services import enqueue_report_run


class ReportTemplateViewSet(TenantModelViewSet):
    queryset = ReportTemplate.objects.select_related("tenant")
    serializer_class = ReportTemplateSerializer
    filterset_fields = ["code"]
    search_fields = ["name", "code"]

    @action(detail=True, methods=["post"])
    def run(self, request, pk=None):
        report_run = enqueue_report_run(self.get_object(), request.data.get("parameters", {}), request.user)
        return Response(ReportRunSerializer(report_run).data)


class ReportRunViewSet(TenantModelViewSet):
    queryset = ReportRun.objects.select_related("template", "tenant")
    serializer_class = ReportRunSerializer
    filterset_fields = ["template", "status"]


class KpiSnapshotViewSet(TenantModelViewSet):
    queryset = KpiSnapshot.objects.select_related("project", "tenant")
    serializer_class = KpiSnapshotSerializer
    filterset_fields = ["project", "snapshot_date", "code", "unit"]
    search_fields = ["code"]
