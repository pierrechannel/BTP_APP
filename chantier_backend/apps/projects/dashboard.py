from types import SimpleNamespace
from datetime import date
from uuid import UUID
from zoneinfo import ZoneInfo

from django.db.models import Avg, Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.budget.models import Expense
from apps.common.permissions import HasRolePermission, HasTenantContext, IsTenantMember
from apps.planning.models import Task
from apps.projects.models import Project
from apps.qhse.models import Incident


class DashboardView(APIView):
    permission_classes = [IsAuthenticated, HasTenantContext, IsTenantMember]

    def get(self, request):
        project_id = request.query_params.get("project")
        if project_id:
            try:
                UUID(project_id)
            except ValueError as exc:
                raise ValidationError({"project": "Identifiant invalide."}) from exc

        def can_read(resource):
            return HasRolePermission().has_permission(
                request, SimpleNamespace(resource_name=resource, action="list")
            )

        projects = Project.objects.filter(tenant_id=request.tenant_id, deleted_at__isnull=True)
        if project_id:
            projects = projects.filter(pk=project_id)
        tasks = Task.objects.filter(tenant_id=request.tenant_id, project__in=projects, deleted_at__isnull=True)
        incidents = Incident.objects.filter(tenant_id=request.tenant_id, project__in=projects, deleted_at__isnull=True)
        expenses = Expense.objects.filter(
            tenant_id=request.tenant_id, budget_line__budget__project__in=projects,
            deleted_at__isnull=True, budget_line__deleted_at__isnull=True,
            budget_line__budget__deleted_at__isnull=True,
        )
        today = timezone.localdate(timezone=ZoneInfo("Africa/Bujumbura"))
        result = {"date": today, "projects": None, "planning": None, "budget": None, "qhse": None}
        if can_read("projects"):
            result["projects"] = {
                "count": projects.count(), "active": projects.filter(status=Project.IN_PROGRESS).count(),
                "recent": list(projects.order_by("-updated_at").values(
                    "id", "name", "code", "status", "client_name", "planned_end_date"
                )[:6]),
            }
        if can_read("planning"):
            pending = tasks.exclude(status__in=[Task.DONE, Task.CANCELLED])
            result["planning"] = {
                "count": tasks.count(), "completed": tasks.filter(status=Task.DONE).count(),
                "progress": tasks.aggregate(value=Avg("progress_percent"))["value"] or 0,
                "overdue": pending.filter(planned_end_date__lt=today).count(),
                "statuses": list(tasks.order_by().values("status").annotate(count=Count("id"))),
                "overdue_tasks": list(pending.filter(planned_end_date__lt=today)
                                 .order_by("planned_end_date", "id").values(
                                     "id", "name", "status", "planned_end_date", "project__name", "project_id"
                                 )[:6]),
                "upcoming": list(pending.filter(planned_end_date__gte=today)
                                 .order_by("planned_end_date", "id").values(
                                     "id", "name", "status", "progress_percent", "planned_end_date",
                                     "project__name", "project_id"
                                 )[:6]),
            }
        if can_read("budget"):
            validated = expenses.filter(status__in=[Expense.VALIDATED, Expense.PAID])
            month_index = today.year * 12 + today.month - 1
            months = [date(index // 12, index % 12 + 1, 1) for index in range(month_index - 11, month_index + 1)]
            amounts = {(row["month"], row["currency"]): row["amount"] for row in validated.filter(date__gte=months[0], date__lte=today)
                       .annotate(month=TruncMonth("date")).values("month", "currency")
                       .annotate(amount=Sum("amount_including_tax"))}
            currencies = list(validated.order_by("currency").values_list("currency", flat=True).distinct())
            result["budget"] = {
                "monthly_spent": [{"month": month, "currency": currency, "amount": amounts.get((month, currency), 0)} for currency in currencies for month in months],
                "count": expenses.count(),
                "pending": expenses.filter(status=Expense.SUBMITTED).count(),
                "drafts": expenses.filter(status=Expense.DRAFT).count(),
                "spent": list(expenses.filter(status__in=[Expense.VALIDATED, Expense.PAID])
                              .order_by("currency").values("currency")
                              .annotate(amount=Sum("amount_including_tax"))),
            }
        if can_read("qhse"):
            result["qhse"] = {"count": incidents.count(),
                              "open": incidents.exclude(status=Incident.CLOSED).count()}
        return Response(result)
