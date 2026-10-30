"""Global dashboard aggregates, exposed only by the superadministrator endpoint."""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.accounts.models import AuditLog, Membership, Tenant, User
from apps.projects.models import Project


def platform_analytics(days):
    zone = ZoneInfo('Africa/Bujumbura')
    now = timezone.now()
    today = now.astimezone(zone).date()
    start = today - timedelta(days=days - 1)
    boundary = datetime.combine(start, time.min, tzinfo=zone)
    previous = boundary - timedelta(days=days)
    end = now
    sources = {'events': (AuditLog.objects.all(), 'created_at'), 'users': (User.objects.all(), 'date_joined'),
        'tenants': (Tenant.objects.all(), 'created_at'),
        'projects': (Project.objects.filter(deleted_at__isnull=True), 'created_at')}
    trend = {(start + timedelta(days=i)): {'date': start + timedelta(days=i), 'events': 0, 'users': 0, 'tenants': 0, 'projects': 0} for i in range(days)}
    current_counts, previous_counts = {}, {}
    for key, (queryset, field) in sources.items():
        current = queryset.filter(**{f'{field}__gte': boundary, f'{field}__lte': end})
        current_counts[key] = current.count()
        previous_counts[key] = queryset.filter(**{f'{field}__gte': previous, f'{field}__lt': boundary}).count()
        for row in current.annotate(day=TruncDate(field, tzinfo=zone)).values('day').annotate(count=Count('pk')).order_by('day'):
            if row['day'] in trend:
                trend[row['day']][key] = row['count']
    project_counts = dict(Project.objects.filter(deleted_at__isnull=True).values('tenant_id').annotate(count=Count('pk')).values_list('tenant_id', 'count'))
    member_counts = dict(Membership.objects.filter(is_active=True).values('tenant_id').annotate(count=Count('user_id', distinct=True)).values_list('tenant_id', 'count'))
    period_events = dict(AuditLog.objects.filter(created_at__gte=boundary, created_at__lte=end).values('tenant_id').annotate(count=Count('pk')).values_list('tenant_id', 'count'))
    tenants = [{'id': tenant.pk, 'name': tenant.name, 'is_active': tenant.is_active,
        'projects': project_counts.get(tenant.pk, 0), 'members': member_counts.get(tenant.pk, 0),
        'events': period_events.get(tenant.pk, 0)} for tenant in Tenant.objects.all()]
    tenants.sort(key=lambda item: (-item['events'], -item['projects'], item['name']))
    latest = AuditLog.objects.select_related('tenant', 'user').order_by('-created_at', '-pk')[:8]
    return {'period': {'days': days, 'start_date': start, 'end_date': today},
        'period_summary': current_counts, 'previous_summary': previous_counts, 'activity': list(trend.values()),
        'project_statuses': list(Project.objects.filter(deleted_at__isnull=True).values('status').annotate(count=Count('pk')).order_by('status')),
        'top_tenants': tenants[:10], 'active_tenants_in_period': len(period_events.keys() - {None}),
        'recent_events': [{'id': item.pk, 'action': item.action, 'resource': item.resource_type,
            'tenant_id': item.tenant_id, 'tenant_name': item.tenant.name if item.tenant else 'Plateforme',
            'user': item.user.email if item.user else 'Système', 'created_at': item.created_at} for item in latest]}
