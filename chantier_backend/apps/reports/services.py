from apps.reports.models import ReportRun, ReportTemplate
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError
from django.db.models import F
from django.utils import timezone
import logging
from datetime import date

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
    if not isinstance(parameters, dict) or set(parameters) - {"project", "start_date", "end_date", "observations"}:
        raise ValidationError({"parameters": "Parametres de rapport invalides."})
    parameters = dict(parameters)
    if "project" in parameters and not isinstance(parameters["project"], str):
        raise ValidationError({"project": "Un code projet est requis."})
    for field in ("start_date", "end_date"):
        if field in parameters:
            try:
                parameters[field] = date.fromisoformat(parameters[field]).isoformat()
            except (ValueError, TypeError):
                raise ValidationError({field: "Utilisez une date au format AAAA-MM-JJ."})
    if parameters.get("start_date") and parameters.get("end_date") and parameters["end_date"] < parameters["start_date"]:
        raise ValidationError({"end_date": "La fin doit suivre le debut."})
    if "observations" in parameters and (not isinstance(parameters["observations"], str) or len(parameters["observations"]) > 5000):
        raise ValidationError({"observations": "Saisissez un texte de 5000 caracteres maximum."})
    if parameters.get("project"):
        from apps.projects.models import Project
        if not Project.objects.filter(tenant=template.tenant, code=parameters["project"], deleted_at__isnull=True).exists():
            raise ValidationError({"project": "Chantier introuvable."})
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
