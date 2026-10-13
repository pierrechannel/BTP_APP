from django.contrib import admin

from apps.workforce.models import Assignment, Certification, TimeEntry, Worker, WorkerCertification

admin.site.register(Worker)
admin.site.register(TimeEntry)
admin.site.register(Certification)
admin.site.register(WorkerCertification)
admin.site.register(Assignment)
