from django.db import connection, DatabaseError
from django.utils import timezone
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AuditLog, Tenant, User
from apps.projects.models import Project
from apps.reports.models import ReportRun
from apps.sync.models import SyncMutation


class IsPlatformAdministrator(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_superuser)


class PlatformOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsPlatformAdministrator]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            data = {
                "status": "available", "database": "available", "checked_at": timezone.now(),
                "tenants": Tenant.objects.count(), "active_tenants": Tenant.objects.filter(is_active=True).count(),
                "users": User.objects.count(), "active_users": User.objects.filter(is_active=True).count(),
                "projects": Project.objects.filter(deleted_at__isnull=True).count(),
                "audit_events": AuditLog.objects.count(),
                "sync_pending": SyncMutation.objects.filter(deleted_at__isnull=True, status="pending").count(),
                "sync_failed": SyncMutation.objects.filter(deleted_at__isnull=True, status="failed").count(),
                "reports_pending": ReportRun.objects.filter(deleted_at__isnull=True, status="pending").count(),
                "reports_failed": ReportRun.objects.filter(deleted_at__isnull=True, status="failed").count(),
            }
        except DatabaseError:
            return Response({"status": "unavailable", "database": "unavailable", "checked_at": timezone.now()}, status=503)
        return Response(data)
