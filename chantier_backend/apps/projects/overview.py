from types import SimpleNamespace
from zoneinfo import ZoneInfo

from django.db.models import Avg, Case, IntegerField, Q, Value, When
from django.utils import timezone

from apps.common.permissions import HasRolePermission


def project_overview(request, project):
    from apps.budget.models import Budget, Expense
    from apps.budget.services import get_budget_summary
    from apps.planning.models import Task
    from apps.progress.models import DailyReport, Photo
    from apps.qhse.models import Incident
    from apps.workforce.models import Assignment

    today = timezone.localdate(timezone=ZoneInfo('Africa/Bujumbura'))
    scope = {'tenant_id': request.tenant_id, 'deleted_at__isnull': True}
    def can(module):
        return HasRolePermission().has_permission(request, SimpleNamespace(resource_name=module, action='list'))

    result = {'date': today, 'planning': None, 'budget': None, 'qhse': None, 'workforce': None, 'activity': []}
    if can('planning'):
        tasks = Task.objects.filter(project=project, **scope).exclude(status=Task.CANCELLED)
        leaves = tasks.exclude(pk__in=tasks.filter(parent_id__isnull=False).values('parent_id'))
        pending = tasks.exclude(status=Task.DONE)
        result['planning'] = {
            'count': tasks.count(), 'completed': tasks.filter(status=Task.DONE).count(),
            'progress': leaves.aggregate(value=Avg(Case(When(status=Task.DONE, then=Value(100)), default='progress_percent', output_field=IntegerField())))['value'],
            'overdue': pending.filter(planned_end_date__lt=today).count(),
            'blocked': pending.filter(status=Task.BLOCKED).count(),
            'tasks': list(pending.order_by('planned_end_date', 'id').filter(planned_end_date__isnull=False).values('id', 'name', 'status', 'planned_end_date', 'progress_percent')[:5]),
        }
    if can('budget'):
        budget = Budget.objects.filter(project=project, **scope).first()
        result['budget'] = get_budget_summary(budget) if budget else {'budget_id': None}
        if budget:
            result['budget']['pending'] = Expense.objects.filter(budget_line__budget=budget, budget_line__deleted_at__isnull=True, status=Expense.SUBMITTED, **scope).count()
    if can('qhse'):
        incidents = Incident.objects.filter(project=project, **scope).exclude(status=Incident.CLOSED)
        result['qhse'] = {'open': incidents.count(), 'recent': list(incidents.order_by('-created_at').values('id', 'title', 'status')[:3])}
    if can('workforce'):
        assignments = Assignment.objects.filter(project=project, start_date__lte=today, worker__deleted_at__isnull=True, **scope).filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
        result['workforce'] = {'assigned': assignments.values('worker_id').distinct().count()}
    activity = []
    if can('progress'):
        for row in DailyReport.objects.filter(project=project, **scope).order_by('-updated_at').values('id', 'report_date', 'status', 'updated_at')[:4]:
            activity.append({**row, 'kind': 'report', 'title': f"Rapport du {row['report_date'].strftime('%d/%m/%Y')}"})
        for row in Photo.objects.filter(project=project, **scope).order_by('-updated_at').values('id', 'updated_at')[:3]:
            activity.append({**row, 'kind': 'photo', 'title': 'Photo de chantier'})
    if can('documents'):
        from apps.documents.permissions import accessible_documents
        for row in accessible_documents(request).filter(folder__project=project, folder__deleted_at__isnull=True, **scope).order_by('-updated_at').values('id', 'title', 'updated_at')[:3]:
            activity.append({**row, 'kind': 'document'})
    result['activity'] = sorted(activity, key=lambda row: row['updated_at'], reverse=True)[:6]
    return result
