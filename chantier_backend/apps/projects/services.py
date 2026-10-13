from django.db import transaction

from apps.accounts.models import Tenant
from apps.projects.models import Project, ProjectStatusHistory

ALLOWED_STATUS_TRANSITIONS = {
    Project.STUDY: {Project.PREPARATION},
    Project.PREPARATION: {Project.IN_PROGRESS, Project.SUSPENDED},
    Project.IN_PROGRESS: {Project.SUSPENDED, Project.HANDOVER},
    Project.SUSPENDED: {Project.IN_PROGRESS, Project.CLOSED},
    Project.HANDOVER: {Project.CLOSED},
    Project.CLOSED: set(),
}


class InvalidProjectStatusTransition(ValueError):
    pass


@transaction.atomic
def create_project(*, tenant: Tenant, user, data: dict) -> Project:
    return Project.objects.create(tenant=tenant, created_by=user, updated_by=user, **data)


@transaction.atomic
def transition_project_status(*, project: Project, to_status: str, user, reason: str = "") -> Project:
    allowed = ALLOWED_STATUS_TRANSITIONS.get(project.status, set())
    if to_status not in allowed:
        raise InvalidProjectStatusTransition(f"Transition {project.status} -> {to_status} interdite.")

    from_status = project.status
    project.status = to_status
    project.updated_by = user
    project.version += 1
    project.save(update_fields=["status", "updated_by", "version", "updated_at"])
    ProjectStatusHistory.objects.create(
        tenant=project.tenant,
        project=project,
        from_status=from_status,
        to_status=to_status,
        reason=reason,
        created_by=user,
        updated_by=user,
    )
    return project
