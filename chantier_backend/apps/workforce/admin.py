from django.contrib import admin

from apps.workforce.models import TimeEntry, Worker

admin.site.register(Worker)
admin.site.register(TimeEntry)
