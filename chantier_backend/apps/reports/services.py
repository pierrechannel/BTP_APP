from apps.reports.models import ReportRun, ReportTemplate
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError
from django.db.models import F
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


def dispatch_report(run_id):
    from apps.reports.tasks import generate_report
    try:
        generate_report.delay(str(run_id))
    except Exception:
        ReportRun.objects.filter(pk=run_id, status="pending").update(
            status="failed", version=F("version") + 1, updated_at=timezone.now()
        )
        logger.exception("Report dispatch failed for run %s", run_id)


def enqueue_report_run(template: ReportTemplate, parameters: dict, user) -> ReportRun:
    if not isinstance(parameters, dict) or set(parameters) - {"project"}:
        raise ValidationError({"parameters": "Seul le parametre project est pris en charge."})
    if "project" in parameters and not isinstance(parameters["project"], str):
        raise ValidationError({"project": "Un code projet est requis."})
    run = ReportRun.objects.create(
        tenant=template.tenant,
        template=template,
        parameters=parameters,
        status="pending",
        created_by=user,
        updated_by=user,
    )
    from apps.reports.tasks import generate_report
    if settings.REPORTS_ASYNC:
        transaction.on_commit(lambda: dispatch_report(run.pk))
    else:
        generate_report(str(run.pk))
        run.refresh_from_db()
    return run
