from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Tenant
from apps.common.models import TenantOwnedModel


def check_deletion_allowed(instance):
    """Protect approved records, including those hidden through deleted parents."""
    pending = [instance]
    visited = set()
    while pending:
        current = pending.pop()
        key = (current._meta.label_lower, current.pk)
        if key in visited or current.deleted_at:
            continue
        visited.add(key)
        financial = current._meta.label_lower in {"budget.expense", "budget.invoice"}
        if current._meta.label_lower == 'progress.dailyreport' and current.status != 'draft':
            raise ValidationError('Un rapport soumis ou validé ne peut pas être supprimé.')
        if current._meta.label_lower == 'progress.photo' and current.daily_report_id and current.daily_report.status != 'draft':
            raise ValidationError('Les photos d’un rapport soumis ou validé sont protégées.')
        if (current._meta.label_lower == "resources.purchaseorder" and current.status != "draft"
                or current._meta.label_lower == "resources.purchaseorderline" and current.purchase_order.status != "draft"):
            raise ValidationError("Une commande envoyee ou finalisee et ses lignes ne peuvent pas etre supprimees.")
        if ((financial and current.status in {"validated", "paid"})
                or (current._meta.label_lower == "workforce.timeentry" and current.is_validated)):
            raise ValidationError("Suppression interdite: cette ressource contient une piece ou un pointage valide.")
        for relation in current._meta.related_objects:
            if (relation.on_delete in {models.CASCADE, models.PROTECT}
                    and issubclass(relation.related_model, TenantOwnedModel)):
                pending.extend(relation.related_model.objects.filter(**{
                    relation.field.name: current, "tenant_id": instance.tenant_id,
                    "deleted_at__isnull": True,
                }))


@transaction.atomic
def soft_delete(instance, user):
    """Preserve the CASCADE tree while making its tenant-owned rows invisible."""
    Tenant.objects.select_for_update().get(pk=instance.tenant_id)
    check_deletion_allowed(instance)
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
