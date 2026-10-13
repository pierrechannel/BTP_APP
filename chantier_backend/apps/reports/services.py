from apps.reports.models import ReportRun, ReportTemplate


def enqueue_report_run(template: ReportTemplate, parameters: dict, user) -> ReportRun:
    return ReportRun.objects.create(
        tenant=template.tenant,
        template=template,
        parameters=parameters,
        status="pending",
        created_by=user,
        updated_by=user,
    )
