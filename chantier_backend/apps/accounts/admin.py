from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import AuditLog, Device, Membership, Role, Tenant, User

admin.site.register(User, UserAdmin)
admin.site.register(Tenant)
admin.site.register(Role)
admin.site.register(Membership)
admin.site.register(AuditLog)
admin.site.register(Device)
