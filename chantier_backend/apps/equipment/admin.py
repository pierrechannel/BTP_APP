from django.contrib import admin

from apps.equipment.models import (
    Equipment,
    EquipmentAssignment,
    MaintenancePlan,
    MaintenanceRecord,
    UsageLog,
)

admin.site.register(Equipment)
admin.site.register(EquipmentAssignment)
admin.site.register(MaintenancePlan)
admin.site.register(MaintenanceRecord)
admin.site.register(UsageLog)
