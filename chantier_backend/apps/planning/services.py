from django.db import transaction

from apps.accounts.models import Tenant
from apps.planning.models import Task, TaskDependency

def update_task_progress(task: Task, progress_percent: int, user) -> Task:
    if type(progress_percent) is not int or progress_percent < 0 or progress_percent > 100:
        raise ValueError("Le pourcentage d'avancement doit etre compris entre 0 et 100.")
    task.progress_percent = progress_percent
    task.updated_by = user
    task.version += 1
    if progress_percent == 100:
        task.status = Task.DONE
    elif progress_percent > 0 and task.status == Task.TODO:
        task.status = Task.IN_PROGRESS
    elif task.status == Task.DONE:
        task.status = Task.IN_PROGRESS if progress_percent else Task.TODO
    task.save(update_fields=["progress_percent", "status", "updated_by", "version", "updated_at"])
    return task


def validate_dependency(predecessor, successor, dependency_type, exclude_id=None):
    if predecessor.tenant_id != successor.tenant_id:
        raise ValueError("Les taches doivent appartenir au meme tenant.")
    if predecessor.id == successor.id:
        raise ValueError("Une tache ne peut pas dependre d'elle-meme.")
    if predecessor.project_id != successor.project_id:
        raise ValueError("Les taches doivent appartenir au meme projet.")
    if predecessor.deleted_at or successor.deleted_at:
        raise ValueError("Une tache supprimee ne peut pas avoir de dependance.")
    if dependency_type not in dict(TaskDependency.TYPE_CHOICES):
        raise ValueError("Type de dependance invalide.")
    if _has_path(successor, predecessor, exclude_id):
        raise ValueError("Dependance circulaire detectee.")


@transaction.atomic
def create_task_dependency(*, predecessor: Task, successor: Task, dependency_type: str, lag_days: int, user):
    Tenant.objects.select_for_update().get(pk=predecessor.tenant_id)
    validate_dependency(predecessor, successor, dependency_type)
    return TaskDependency.objects.create(
        tenant=predecessor.tenant,
        predecessor=predecessor,
        successor=successor,
        dependency_type=dependency_type,
        lag_days=lag_days,
        created_by=user,
        updated_by=user,
    )


def _has_path(start: Task, target: Task, exclude_id=None) -> bool:
    edges = {}
    for predecessor_id, successor_id in TaskDependency.objects.filter(
        tenant_id=start.tenant_id, deleted_at__isnull=True,
        predecessor__deleted_at__isnull=True, successor__deleted_at__isnull=True,
    ).exclude(pk=exclude_id).values_list("predecessor_id", "successor_id"):
        edges.setdefault(predecessor_id, []).append(successor_id)
    visited = set()
    stack = [start.id]
    while stack:
        task_id = stack.pop()
        if task_id == target.id:
            return True
        if task_id in visited:
            continue
        visited.add(task_id)
        stack.extend(edges.get(task_id, []))
    return False
