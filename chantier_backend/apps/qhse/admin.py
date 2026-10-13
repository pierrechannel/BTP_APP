from django.contrib import admin

from apps.qhse.models import CorrectiveAction, Incident

admin.site.register(Incident)
admin.site.register(CorrectiveAction)
