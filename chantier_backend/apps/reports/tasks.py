import json
import logging

from django.core.files.base import ContentFile
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models import Avg, Count, Sum

from config.celery import app
from apps.budget.models import Expense
from apps.planning.models import Task
from apps.projects.models import Project
from apps.qhse.models import Incident
from apps.reports.models import ReportRun

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
            for project in projects:
                tasks = Task.objects.filter(project=project, tenant=run.tenant, deleted_at__isnull=True)
                expenses = Expense.objects.filter(
                    tenant=run.tenant, budget_line__budget__project=project,
                    deleted_at__isnull=True, budget_line__deleted_at__isnull=True,
                    budget_line__budget__deleted_at__isnull=True,
                    status__in=[Expense.VALIDATED, Expense.PAID],
                )
                rows.append({
                    "id": project.pk, "code": project.code, "name": project.name,
                    "tasks": tasks.aggregate(count=Count("id"), progress=Avg("progress_percent")),
                    # Preserve currency groups instead of adding incompatible amounts.
                    "expenses": list(expenses.values("currency").annotate(total=Sum("amount_including_tax"))),
                    "incidents": Incident.objects.filter(
                        tenant=run.tenant, project=project, deleted_at__isnull=True
                    ).count(),
                })
            content = json.dumps({"template": run.template.code, "projects": rows}, cls=DjangoJSONEncoder)
            run.result_file.save(f"{run.pk}.json", ContentFile(content.encode("utf-8")), save=False)
            run.status = "completed"
            run.version += 1
            run.save(update_fields=["result_file", "status", "version", "updated_at"])
    except Exception:
        ReportRun.objects.filter(pk=run_id).update(status="failed")
        logger.exception("Report generation failed for run %s", run_id)
        raise
