from django.contrib import admin

from apps.planning.models import Task, TaskDependency

admin.site.register(Task)
admin.site.register(TaskDependency)
