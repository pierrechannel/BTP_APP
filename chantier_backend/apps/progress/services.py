from apps.progress.models import DailyReport
from apps.progress.models import Snag
from rest_framework.exceptions import ValidationError


def submit_daily_report(report: DailyReport, user) -> DailyReport:
    if report.status == DailyReport.SUBMITTED:
        return report
    if report.status != DailyReport.DRAFT:
        raise ValidationError("Seul un brouillon peut etre soumis.")
    report.status = DailyReport.SUBMITTED
    report.updated_by = user
    report.version += 1
    report.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return report


def resolve_snag(snag: Snag, user) -> Snag:
    from django.utils import timezone

    snag.status = Snag.RESOLVED
    snag.resolved_at = timezone.now()
    snag.updated_by = user
    snag.version += 1
    snag.save(update_fields=["status", "resolved_at", "updated_by", "version", "updated_at"])
    return snag


def validate_daily_report(report: DailyReport, user) -> DailyReport:
    if report.status != DailyReport.SUBMITTED:
        raise ValidationError("Le rapport doit etre soumis avant validation.")
    report.status = DailyReport.VALIDATED
    report.updated_by = user
    report.version += 1
    report.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return report
