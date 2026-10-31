from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import FileResponse, Http404
from pathlib import Path

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
    permission_action_map = {**TenantModelViewSet.permission_action_map, 'correction': 'validate', 'pdf': 'read'}
    ordering = ['-report_date', '-created_at']
    queryset = DailyReport.objects.select_related("project", "tenant")
    serializer_class = DailyReportSerializer
    filterset_fields = ["project", "report_date", "status"]
    search_fields = ["weather", "work_done", "difficulties"]

    def get_queryset(self):
        from rest_framework import serializers
        queryset = super().get_queryset()
        from django.db.models import Prefetch
        queryset = queryset.prefetch_related(Prefetch('photo_set', queryset=Photo.objects.filter(tenant_id=self.request.tenant_id, deleted_at__isnull=True), to_attr='_active_photos'))
        for name, lookup in [('start_date', 'report_date__gte'), ('end_date', 'report_date__lte')]:
            if self.request.query_params.get(name):
                queryset = queryset.filter(**{lookup: serializers.DateField().run_validation(self.request.query_params[name])})
        if self.request.query_params.get('start_date') and self.request.query_params.get('end_date') and self.request.query_params['start_date'] > self.request.query_params['end_date']:
            raise serializers.ValidationError('La fin doit suivre le début.')
        return queryset

    @action(detail=True, methods=['post'])
    def correction(self, request, pk=None):
        from apps.progress.services import request_correction
        report = request_correction(self.get_object(), request.user, request.data.get('comment', ''))
        return Response(self.get_serializer(report).data)

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        from apps.progress.pdf import daily_report_pdf
        return daily_report_pdf(self.get_object())

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

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        photo = self.get_object()
        if not photo.image:
            raise Http404
        try:
            return FileResponse(photo.image.open("rb"), as_attachment=True,
                                filename=Path(photo.image.name).name)
        except FileNotFoundError as exc:
            raise Http404 from exc


class ProgressUpdateViewSet(TenantModelViewSet):
    queryset = ProgressUpdate.objects.select_related("project", "task", "tenant")
    serializer_class = ProgressUpdateSerializer
    filterset_fields = ["project", "task", "update_date"]

    def perform_destroy(self, instance):
        from apps.progress.services import sync_task_progress
        super().perform_destroy(instance)
        sync_task_progress(instance.task, self.request.user)


class SnagViewSet(TenantModelViewSet):
    permission_action_map = {**TenantModelViewSet.permission_action_map, 'transition': 'update'}
    queryset = Snag.objects.select_related("project", "task", "tenant")
    serializer_class = SnagSerializer
    filterset_fields = ["project", "task", "status", "due_date"]
    search_fields = ["title", "description", "responsible_name"]

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        from rest_framework.exceptions import ValidationError
        snag = self.get_object()
        target = request.data.get('status')
        allowed = {'open': {'in_progress'}, 'in_progress': {'open'}, 'resolved': {'closed', 'open'}}
        if target not in allowed.get(snag.status, set()):
            raise ValidationError('Transition de réserve interdite.')
        snag.status = target
        if target == 'open':
            snag.resolved_at = None
        snag.updated_by = request.user
        snag.version += 1
        snag.save(update_fields=['status', 'resolved_at', 'updated_by', 'version', 'updated_at'])
        return Response(self.get_serializer(snag).data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        snag = resolve_snag(self.get_object(), request.user)
        return Response(self.get_serializer(snag).data)
