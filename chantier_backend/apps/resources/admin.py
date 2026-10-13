from django.contrib import admin

from apps.resources.models import (
    Material,
    PurchaseOrder,
    PurchaseOrderLine,
    StockLocation,
    StockMovement,
    Supplier,
)

admin.site.register(Material)
admin.site.register(Supplier)
admin.site.register(PurchaseOrder)
admin.site.register(PurchaseOrderLine)
admin.site.register(StockLocation)
admin.site.register(StockMovement)
