from apps.resources.models import Material
from apps.resources.models import StockMovement


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
