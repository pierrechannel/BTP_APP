from django.db import models

from apps.common.models import TenantOwnedModel


class Task(TenantOwnedModel):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"
    CANCELLED = "cancelled"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="tasks")
    lot = models.ForeignKey("projects.Lot", null=True, blank=True, on_delete=models.SET_NULL)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, default=TODO)
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    progress_percent = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["tenant", "project", "status"])]


class TaskDependency(TenantOwnedModel):
    FINISH_START = "FS"
    START_START = "SS"
    FINISH_FINISH = "FF"
    START_FINISH = "SF"

    TYPE_CHOICES = [
        (FINISH_START, "Finish to start"),
        (START_START, "Start to start"),
        (FINISH_FINISH, "Finish to finish"),
        (START_FINISH, "Start to finish"),
    ]

    predecessor = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="successor_links")
    successor = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="predecessor_links")
    dependency_type = models.CharField(max_length=2, choices=TYPE_CHOICES, default=FINISH_START)
    lag_days = models.IntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["predecessor", "successor", "dependency_type"],
                name="unique_task_dependency",
            )
        ]
        indexes = [models.Index(fields=["tenant", "predecessor", "successor"])]
