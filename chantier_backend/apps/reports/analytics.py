from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Avg, Count, Q, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import serializers

from apps.budget.models import BudgetLine, Expense
from apps.planning.models import Task
from apps.projects.models import Project
from apps.qhse.models import Incident


class AnalyticsFilters(serializers.Serializer):
    project = serializers.UUIDField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        if attrs.get("start_date") and attrs.get("end_date") and attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError({"end_date": "La fin doit suivre le début."})
        return attrs


def report_analytics(tenant_id, params):
    filters = AnalyticsFilters(data=params)
    filters.is_valid(raise_exception=True)
    values = filters.validated_data
    projects = Project.objects.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if values.get("project"):
        projects = projects.filter(pk=values["project"])
    tasks = Task.objects.filter(tenant_id=tenant_id, project__in=projects, deleted_at__isnull=True)
    expenses = Expense.objects.filter(tenant_id=tenant_id, budget_line__budget__project__in=projects,
        deleted_at__isnull=True, budget_line__deleted_at__isnull=True, budget_line__budget__deleted_at__isnull=True,
        status__in=[Expense.VALIDATED, Expense.PAID])
    incidents = Incident.objects.filter(tenant_id=tenant_id, project__in=projects, deleted_at__isnull=True)
    for key, lookup in (("start_date", "gte"), ("end_date", "lte")):
        if key in values:
            boundary = values[key]
            expenses = expenses.filter(**{f"date__{lookup}": boundary})
            instant = datetime.combine(boundary, time.min, tzinfo=ZoneInfo("Africa/Bujumbura"))
            incidents = incidents.filter(**{"occurred_at__gte" if lookup == "gte" else "occurred_at__lt": instant if lookup == "gte" else instant + timedelta(days=1)})
            field = "planned_end_date" if lookup == "gte" else "planned_start_date"
            tasks = tasks.filter(Q(**{f"{field}__{lookup}": boundary}) | Q(**{f"{field}__isnull": True}))
    today = timezone.now().astimezone(ZoneInfo("Africa/Bujumbura")).date()
    overdue = tasks.exclude(status__in=[Task.DONE, Task.CANCELLED]).filter(planned_end_date__lt=today)
    budget = BudgetLine.objects.filter(tenant_id=tenant_id, budget__project__in=projects, deleted_at__isnull=True, budget__deleted_at__isnull=True)

    def finance_rows(planned_query, spent_query):
        planned = dict(planned_query.values("currency").annotate(total=Sum("amount")).values_list("currency", "total"))
        spent = dict(spent_query.values("currency").annotate(total=Sum("amount_including_tax")).values_list("currency", "total"))
        return [{"currency": c, "planned": planned.get(c, 0), "spent": spent.get(c, 0), "remaining": planned.get(c, 0) - spent.get(c, 0)} for c in sorted(set(planned) | set(spent))]

    # Aggregate by project once rather than issuing queries for each table row.
    task_groups = {str(row["project_id"]): row for row in tasks.values("project_id").annotate(count=Count("id"), progress=Avg("progress_percent"), completed=Count("id", filter=Q(status=Task.DONE)))}
    overdue_groups = {str(row["project_id"]): row["count"] for row in overdue.values("project_id").annotate(count=Count("id"))}
    incident_groups = {str(row["project_id"]): row for row in incidents.values("project_id").annotate(count=Count("id"), open=Count("id", filter=~Q(status=Incident.CLOSED)))}
    project_rows = []
    for project in projects:
        task = task_groups.get(str(project.pk), {})
        incident = incident_groups.get(str(project.pk), {})
        project_rows.append({"id": project.pk, "name": project.name, "code": project.code, "status": project.status,
            "tasks": task.get("count", 0), "completed": task.get("completed", 0), "progress": task.get("progress") or 0,
            "overdue": overdue_groups.get(str(project.pk), 0), "incidents": incident.get("count", 0), "open_incidents": incident.get("open", 0)})
    monthly = list(expenses.annotate(month=TruncMonth("date")).values("month", "currency").annotate(amount=Sum("amount_including_tax")).order_by("month", "currency"))
    return {
        "as_of": today,
        "kpis": {"projects": len(project_rows), "tasks": tasks.count(), "completed": tasks.filter(status=Task.DONE).count(),
            "progress": tasks.aggregate(value=Avg("progress_percent"))["value"] or 0,
            "overdue": overdue.count(), "open_incidents": incidents.exclude(status=Incident.CLOSED).count()},
        "statuses": list(tasks.values("status").annotate(count=Count("id")).order_by("status")),
        "finances": finance_rows(budget, expenses), "monthly_expenses": monthly, "projects": project_rows,
    }
