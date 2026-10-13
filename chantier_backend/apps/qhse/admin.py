from django.contrib import admin

from apps.qhse.models import (
    CorrectiveAction,
    Incident,
    Inspection,
    InspectionItem,
    InspectionTemplate,
    Ppsps,
)

admin.site.register(Incident)
admin.site.register(CorrectiveAction)
admin.site.register(InspectionTemplate)
admin.site.register(Inspection)
admin.site.register(InspectionItem)
admin.site.register(Ppsps)
