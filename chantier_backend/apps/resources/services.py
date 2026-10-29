from apps.resources.models import Material
from apps.resources.models import StockMovement
from apps.resources.models import PurchaseOrder
from apps.accounts.models import Tenant
from django.db import transaction
from rest_framework.exceptions import ValidationError


@transaction.atomic
def transition_purchase_order(order, target, user):
    Tenant.objects.select_for_update().get(pk=order.tenant_id)
    order = PurchaseOrder.objects.select_for_update().get(pk=order.pk)
    allowed = {
        PurchaseOrder.DRAFT: {PurchaseOrder.SENT, PurchaseOrder.CANCELLED},
        PurchaseOrder.SENT: {PurchaseOrder.PARTIALLY_RECEIVED, PurchaseOrder.RECEIVED, PurchaseOrder.CANCELLED},
        PurchaseOrder.PARTIALLY_RECEIVED: {PurchaseOrder.RECEIVED},
    }
    if target not in allowed.get(order.status, set()):
        raise ValidationError({"to_status": "Transition de commande interdite."})
    if target == PurchaseOrder.SENT and not order.lines.filter(deleted_at__isnull=True).exists():
        raise ValidationError("Ajoutez au moins une ligne avant d'envoyer la commande.")
    order.status = target
    order.updated_by = user
    order.version += 1
    order.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return order


def update_material_price(material: Material, unit_price, user) -> Material:
    material.unit_price = unit_price
    material.updated_by = user
    material.version += 1
    material.save(update_fields=["unit_price", "updated_by", "version", "updated_at"])
    return material


def record_stock_movement(movement: StockMovement, user) -> StockMovement:
    movement.updated_by = user
    movement.version += 1
    movement.save(update_fields=["updated_by", "version", "updated_at"])
    return movement
