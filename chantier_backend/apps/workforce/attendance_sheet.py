from copy import copy

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Tenant
from apps.common.concurrency import VersionConflict
from apps.common.permissions import HasRolePermission
from apps.projects.models import Project
from apps.workforce.models import Assignment, TimeEntry, Worker


class SheetScope(serializers.Serializer):
    project = serializers.UUIDField()
    work_date = serializers.DateField()


class SheetLine(serializers.Serializer):
    worker = serializers.UUIDField()
    entry_id = serializers.UUIDField(required=False, allow_null=True)
    version = serializers.IntegerField(min_value=1, required=False)
    normal_hours = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0)
    overtime_hours = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=0)


class SheetInput(SheetScope):
    entries = SheetLine(many=True, allow_empty=False, max_length=1000)


def assigned_workers(tenant_id, project, work_date):
    assignments = Assignment.objects.filter(tenant_id=tenant_id, project=project,
        deleted_at__isnull=True, archived_at__isnull=True, start_date__lte=work_date).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=work_date))
    return Worker.objects.filter(tenant_id=tenant_id, deleted_at__isnull=True, archived_at__isnull=True,
        pk__in=assignments.values('worker_id')).order_by('last_name', 'first_name')


def sheet_scope(request, data):
    scope = SheetScope(data=data)
    scope.is_valid(raise_exception=True)
    project = get_object_or_404(Project, pk=scope.validated_data['project'], tenant_id=request.tenant_id,
        deleted_at__isnull=True, archived_at__isnull=True)
    return project, scope.validated_data['work_date']


def read_sheet(request):
    project, work_date = sheet_scope(request, request.query_params)
    workers = list(assigned_workers(request.tenant_id, project, work_date))
    entries = TimeEntry.objects.filter(tenant_id=request.tenant_id, project=project, work_date=work_date,
        worker__in=workers, deleted_at__isnull=True).select_related('task').order_by('created_at')
    by_worker = {}
    for entry in entries:
        by_worker.setdefault(entry.worker_id, []).append(entry)
    rows = []
    for worker in workers:
        for entry in by_worker.get(worker.pk) or [None]:
            rows.append({'worker': worker.pk, 'name': f'{worker.first_name} {worker.last_name}',
                'job_title': worker.job_title, 'entry_id': entry.pk if entry else None,
                'version': entry.version if entry else None, 'task_name': entry.task.name if entry and entry.task else '',
                'normal_hours': str(entry.normal_hours) if entry else '',
                'overtime_hours': str(entry.overtime_hours) if entry else '',
                'is_validated': entry.is_validated if entry else False,
                'is_archived': bool(entry.archived_at) if entry else False})
    return {'project': project.pk, 'work_date': work_date, 'rows': rows}


@transaction.atomic
def save_sheet(view, request):
    Tenant.objects.select_for_update().get(pk=request.tenant_id)
    payload = SheetInput(data=request.data)
    payload.is_valid(raise_exception=True)
    project, work_date = sheet_scope(request, payload.validated_data)
    workers = {worker.pk: worker for worker in assigned_workers(request.tenant_id, project, work_date)}
    seen = set()
    saved = []
    for row in payload.validated_data['entries']:
        worker = workers.get(row['worker'])
        if not worker:
            raise serializers.ValidationError({'entries': 'Un collaborateur n’est plus affecté à ce chantier à cette date. Rechargez la feuille.'})
        entry_id = row.get('entry_id')
        key = ('existing', entry_id) if entry_id else ('new', worker.pk)
        if key in seen:
            raise serializers.ValidationError({'entries': 'Une ligne est présente plusieurs fois.'})
        seen.add(key)
        instance = None
        if entry_id:
            update_view = copy(view)
            update_view.action = 'partial_update'
            if not HasRolePermission().has_permission(request, update_view):
                raise PermissionDenied('Vous ne pouvez pas modifier les pointages existants.')
            instance = get_object_or_404(TimeEntry, pk=entry_id, worker=worker, project=project,
                work_date=work_date, tenant_id=request.tenant_id, deleted_at__isnull=True, archived_at__isnull=True)
            if row.get('version') != instance.version:
                raise VersionConflict()
        elif TimeEntry.objects.filter(tenant_id=request.tenant_id, worker=worker, project=project,
                work_date=work_date, deleted_at__isnull=True).exists():
            raise VersionConflict('Un pointage existe déjà pour ce collaborateur. Rechargez la feuille.')
        data = {'worker': str(worker.pk), 'project': str(project.pk), 'work_date': work_date,
            'normal_hours': row['normal_hours'], 'overtime_hours': row['overtime_hours']}
        serializer = view.get_serializer(instance, data=data, partial=bool(instance))
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'entries': {str(worker.pk): exc.detail}}) from exc
        if instance:
            view.perform_update(serializer)
        else:
            view.perform_create(serializer)
        saved.append(serializer.data)
    return {'saved': saved, 'count': len(saved)}
