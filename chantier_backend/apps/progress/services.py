from apps.progress.models import DailyReport


def submit_daily_report(report: DailyReport, user) -> DailyReport:
    report.status = DailyReport.SUBMITTED
    report.updated_by = user
    report.version += 1
    report.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return report


def validate_daily_report(report: DailyReport, user) -> DailyReport:
    report.status = DailyReport.VALIDATED
    report.updated_by = user
    report.version += 1
    report.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return report
