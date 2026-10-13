from apps.planning.models import Task


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
