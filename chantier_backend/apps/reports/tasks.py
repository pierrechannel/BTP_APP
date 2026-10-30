import logging
from datetime import date, datetime, time, timedelta

from django.core.files.base import ContentFile
from django.utils import timezone
from zoneinfo import ZoneInfo
from django.db import transaction
from django.db.models import Avg, Count, Sum, Q

from config.celery import app
from apps.budget.models import BudgetLine, Expense
from apps.planning.models import Task
from apps.projects.models import Project
from apps.qhse.models import CorrectiveAction, Incident
from apps.reports.models import ReportRun
from apps.reports.pdf import build_report_pdf

logger = logging.getLogger(__name__)


@app.task
def generate_report(run_id):
    try:
        with transaction.atomic():
            run = ReportRun.objects.select_for_update().get(pk=run_id, deleted_at__isnull=True)
            if run.status == "completed":
                return
            projects = Project.objects.filter(tenant=run.tenant, deleted_at__isnull=True)
            project_code = run.parameters.get("project")
            if project_code:
                projects = projects.filter(code=project_code)
            rows = []
            today = timezone.now().astimezone(ZoneInfo("Africa/Bujumbura")).date()
            for project in projects:
                tasks = Task.objects.filter(project=project, tenant=run.tenant, deleted_at__isnull=True)
                expenses = Expense.objects.filter(
                    tenant=run.tenant, budget_line__budget__project=project,
                    deleted_at__isnull=True, budget_line__deleted_at__isnull=True,
                    budget_line__budget__deleted_at__isnull=True,
                    status__in=[Expense.VALIDATED, Expense.PAID],
                )
                incidents = Incident.objects.filter(tenant=run.tenant, project=project, deleted_at__isnull=True)
                for key, lookup in (("start_date", "gte"), ("end_date", "lte")):
                    if run.parameters.get(key):
                        boundary = date.fromisoformat(run.parameters[key])
                        expenses = expenses.filter(**{f"date__{lookup}": boundary})
                        instant = datetime.combine(boundary, time.min, tzinfo=ZoneInfo("Africa/Bujumbura"))
                        incidents = incidents.filter(**{"occurred_at__gte" if lookup == "gte" else "occurred_at__lt": instant if lookup == "gte" else instant + timedelta(days=1)})
                        task_field = "planned_end_date" if lookup == "gte" else "planned_start_date"
                        tasks = tasks.filter(Q(**{f"{task_field}__{lookup}": boundary}) | Q(**{f"{task_field}__isnull": True}))
                task_details = list(tasks.order_by("planned_end_date", "name"))
                for task in task_details:
                    task.is_overdue = bool(task.planned_end_date and task.planned_end_date < today and task.status not in [Task.DONE, Task.CANCELLED])
                planned = dict(BudgetLine.objects.filter(tenant=run.tenant, budget__project=project, deleted_at__isnull=True, budget__deleted_at__isnull=True).values("currency").annotate(total=Sum("amount")).values_list("currency", "total"))
                spent = dict(expenses.values("currency").annotate(total=Sum("amount_including_tax")).values_list("currency", "total"))
                finances = [{"currency": currency, "planned": planned.get(currency, 0), "spent": spent.get(currency, 0), "remaining": planned.get(currency, 0) - spent.get(currency, 0)} for currency in sorted(set(planned) | set(spent))]
                rows.append({
                    "expense_details": list(expenses.select_related("budget_line").order_by("date", "created_at")),
                    "finances": finances,
                    "completed": tasks.filter(status=Task.DONE).count(),
                    "overdue": sum(task.is_overdue for task in task_details),
                    "open_incidents": incidents.exclude(status=Incident.CLOSED).count(),
                    "actions": list(CorrectiveAction.objects.filter(tenant=run.tenant, incident__in=incidents, deleted_at__isnull=True).select_related("incident").order_by("due_date")),
                    "project": project,
                    "task_details": task_details,
                    "incident_details": list(incidents.order_by("-occurred_at")),
                    "id": project.pk, "code": project.code, "name": project.name,
                    "tasks": tasks.aggregate(count=Count("id"), progress=Avg("progress_percent")),
                    # Preserve currency groups instead of adding incompatible amounts.
                    "expenses": list(expenses.values("currency").annotate(total=Sum("amount_including_tax"))),
                    "incidents": incidents.count(),
                })
            task_count = sum(row["tasks"]["count"] for row in rows)
            spending = {}
            for row in rows:
                for amount in row["expenses"]:
                    spending[amount["currency"]] = spending.get(amount["currency"], 0) + amount["total"]
            content = build_report_pdf({
                "run": run, "rows": rows, "project_count": len(rows),
                "task_count": task_count,
                "completed_count": sum(row["completed"] for row in rows),
                "open_incident_count": sum(row["open_incidents"] for row in rows),
                "progress": sum((row["tasks"]["progress"] or 0) * row["tasks"]["count"] for row in rows) / task_count if task_count else 0,
                "spending": sorted(spending.items()),
                "incident_count": sum(row["incidents"] for row in rows),
                "generated_at": timezone.now().astimezone(ZoneInfo("Africa/Bujumbura")),
            })
            run.result_file.save(f"{run.pk}.pdf", ContentFile(content), save=False)
            run.status = "completed"
            run.version += 1
            run.save(update_fields=["result_file", "status", "version", "updated_at"])
    except Exception:
        ReportRun.objects.filter(pk=run_id).update(status="failed")
        logger.exception("Report generation failed for run %s", run_id)
        raise
