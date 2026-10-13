from django.contrib import admin

from apps.projects.models import Lot, Project, ProjectStatusHistory, Stakeholder

admin.site.register(Project)
admin.site.register(Lot)
admin.site.register(Stakeholder)
admin.site.register(ProjectStatusHistory)
