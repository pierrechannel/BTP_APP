from django.db import models

from apps.common.models import TenantOwnedModel


class Material(TenantOwnedModel):
    reference = models.CharField(max_length=80)
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=30)
    unit_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="BIF")


class Supplier(TenantOwnedModel):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)


class PurchaseOrder(TenantOwnedModel):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    CANCELLED = "cancelled"

    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, related_name="purchase_orders")
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    order_number = models.CharField(max_length=80)
    status = models.CharField(max_length=30, default=DRAFT)
    ordered_at = models.DateField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "order_number"], name="unique_po_per_tenant")
        ]


class PurchaseOrderLine(TenantOwnedModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name="purchase_order_lines")
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    unit_price = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="BIF")


class StockLocation(TenantOwnedModel):
    project = models.ForeignKey("projects.Project", null=True, blank=True, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "code"], name="unique_stock_location_per_tenant")
        ]


class StockMovement(TenantOwnedModel):
    IN = "in"
    OUT = "out"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"

    material = models.ForeignKey(Material, on_delete=models.PROTECT, related_name="stock_movements")
    source_location = models.ForeignKey(
        StockLocation, null=True, blank=True, on_delete=models.PROTECT, related_name="outgoing_movements"
    )
    target_location = models.ForeignKey(
        StockLocation, null=True, blank=True, on_delete=models.PROTECT, related_name="incoming_movements"
    )
    movement_type = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=18, decimal_places=3)
    movement_date = models.DateField()
    notes = models.TextField(blank=True)
