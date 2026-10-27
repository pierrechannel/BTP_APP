from decimal import Decimal

from django.db.models import Sum

from apps.resources.models import StockMovement


def stock_at(material, location):
    movements = StockMovement.objects.filter(tenant_id=material.tenant_id, material=material, deleted_at__isnull=True)
    incoming = movements.filter(target_location=location).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    outgoing = movements.filter(source_location=location).aggregate(total=Sum("quantity"))["total"] or Decimal("0")
    return incoming - outgoing
