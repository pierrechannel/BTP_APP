from apps.progress.models import DailyReport
from apps.progress.models import Snag
from rest_framework.exceptions import ValidationError
from django.db import transaction


def user_label(user):
    return (user.get_full_name().strip() or user.username) if user else 'Utilisateur supprimé'


def report_history(report):
    if report.workflow_history:
        return list(report.workflow_history)
    history = [{'action': 'created', 'at': report.created_at.isoformat(), 'actor': user_label(report.created_by), 'legacy': True}]
    if report.submitted_at:
        history.append({'action': 'submitted', 'at': report.submitted_at.isoformat(), 'actor': 'Auteur non enregistré', 'legacy': True})
    if report.correction_reason:
        history.append({'action': 'correction', 'at': None, 'actor': 'Auteur non enregistré', 'reason': report.correction_reason, 'legacy': True})
    if report.validated_at:
        history.append({'action': 'validated', 'at': report.validated_at.isoformat(), 'actor': user_label(report.validated_by), 'legacy': True})
    return history


def append_report_event(report, action, user, reason=''):
    from django.utils import timezone
    report.workflow_history = report_history(report) + [{'action': action, 'at': timezone.now().isoformat(), 'actor': user_label(user), 'actor_id': str(user.pk), 'reason': reason}]


@transaction.atomic
def submit_daily_report(report: DailyReport, user) -> DailyReport:
    if report.status == DailyReport.SUBMITTED:
        return report
    if report.status != DailyReport.DRAFT:
        raise ValidationError("Seul un brouillon peut etre soumis.")
    if not report.work_done.strip():
        raise ValidationError({'work_done': 'Décrivez les travaux réalisés avant de soumettre le rapport.'})
    from django.utils import timezone
    append_report_event(report, 'submitted', user)
    report.submitted_at = timezone.now()
    report.status = DailyReport.SUBMITTED
    report.updated_by = user
    report.version += 1
    report.save(update_fields=["status", "submitted_at", "workflow_history", "updated_by", "version", "updated_at"])
    return report


def resolve_snag(snag: Snag, user) -> Snag:
    from django.utils import timezone

    if snag.status not in [Snag.OPEN, Snag.IN_PROGRESS]:
        raise ValidationError('Seule une réserve ouverte ou en cours peut être résolue.')
    snag.status = Snag.RESOLVED
    snag.resolved_at = timezone.now()
    snag.updated_by = user
    snag.version += 1
    snag.save(update_fields=["status", "resolved_at", "updated_by", "version", "updated_at"])
    return snag


@transaction.atomic
def validate_daily_report(report: DailyReport, user) -> DailyReport:
    if report.status != DailyReport.SUBMITTED:
        raise ValidationError("Le rapport doit etre soumis avant validation.")
    append_report_event(report, 'validated', user)
    report.status = DailyReport.VALIDATED
    from django.utils import timezone
    report.validated_at = timezone.now()
    report.validated_by = user
    report.updated_by = user
    report.version += 1
    report.save(update_fields=["status", "validated_at", "validated_by", "workflow_history", "updated_by", "version", "updated_at"])
    return report


@transaction.atomic
def request_correction(report, user, reason):
    if report.status != DailyReport.SUBMITTED or not isinstance(reason, str) or not reason.strip():
        raise ValidationError('Un rapport soumis et un motif de correction sont nécessaires.')
    append_report_event(report, 'correction', user, reason.strip())
    report.status = DailyReport.DRAFT
    report.correction_reason = reason.strip()
    report.updated_by = user
    report.version += 1
    report.save(update_fields=['status', 'correction_reason', 'workflow_history', 'updated_by', 'version', 'updated_at'])
    return report


def sync_task_progress(task, user):
    from apps.progress.models import ProgressUpdate
    from apps.planning.services import update_task_progress
    latest = ProgressUpdate.objects.filter(task=task, tenant_id=task.tenant_id, deleted_at__isnull=True).order_by('-update_date', '-created_at', '-id').first()
    update_task_progress(task, latest.progress_percent if latest else 0, user)
