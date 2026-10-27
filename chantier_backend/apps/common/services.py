from django.db import models, transaction
from django.utils import timezone

from apps.accounts.models import Tenant
from apps.common.models import TenantOwnedModel


@transaction.atomic
def soft_delete(instance, user):
    """Preserve the CASCADE tree while making its tenant-owned rows invisible."""
    Tenant.objects.select_for_update().get(pk=instance.tenant_id)
    pending = [instance]
    visited = set()
    deleted_at = timezone.now()
    while pending:
        current = pending.pop()
        key = (current._meta.label, current.pk)
        if key in visited or current.deleted_at:
            continue
        visited.add(key)
        for relation in current._meta.related_objects:
            if (relation.on_delete is models.SET_NULL
                    and issubclass(relation.related_model, TenantOwnedModel)):
                relation.related_model.objects.filter(**{
                    relation.field.name: current, "tenant_id": instance.tenant_id,
                    "deleted_at__isnull": True,
                }).update(**{relation.field.name: None, "updated_by": user,
                             "version": models.F("version") + 1, "updated_at": deleted_at})
            if (relation.on_delete is models.CASCADE
                    and issubclass(relation.related_model, TenantOwnedModel)):
                pending.extend(relation.related_model.objects.filter(**{
                    relation.field.name: current, "tenant_id": instance.tenant_id,
                    "deleted_at__isnull": True,
                }))
        current.deleted_at = deleted_at
        current.updated_by = user
        current.version += 1
        current.save(update_fields=["deleted_at", "updated_by", "version", "updated_at"])
