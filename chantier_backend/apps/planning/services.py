from apps.planning.models import Task
from apps.planning.models import TaskDependency


def update_task_progress(task: Task, progress_percent: int, user) -> Task:
    if progress_percent < 0 or progress_percent > 100:
        raise ValueError("Le pourcentage d'avancement doit etre compris entre 0 et 100.")
    task.progress_percent = progress_percent
    task.updated_by = user
    task.version += 1
    if progress_percent == 100:
        task.status = Task.DONE
    task.save(update_fields=["progress_percent", "status", "updated_by", "version", "updated_at"])
    return task


def create_task_dependency(*, predecessor: Task, successor: Task, dependency_type: str, lag_days: int, user):
    if predecessor.tenant_id != successor.tenant_id:
        raise ValueError("Les taches doivent appartenir au meme tenant.")
    if predecessor.id == successor.id:
        raise ValueError("Une tache ne peut pas dependre d'elle-meme.")
    if _has_path(successor, predecessor):
        raise ValueError("Dependance circulaire detectee.")
    return TaskDependency.objects.create(
        tenant=predecessor.tenant,
        predecessor=predecessor,
        successor=successor,
        dependency_type=dependency_type,
        lag_days=lag_days,
        created_by=user,
        updated_by=user,
    )


def _has_path(start: Task, target: Task) -> bool:
    visited = set()
    stack = [start.id]
    while stack:
        task_id = stack.pop()
        if task_id == target.id:
            return True
        if task_id in visited:
            continue
        visited.add(task_id)
        stack.extend(
            TaskDependency.objects.filter(predecessor_id=task_id).values_list("successor_id", flat=True)
        )
    return False
