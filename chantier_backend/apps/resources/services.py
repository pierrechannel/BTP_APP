from apps.resources.models import Material


def update_material_price(material: Material, unit_price, user) -> Material:
    material.unit_price = unit_price
    material.updated_by = user
    material.version += 1
    material.save(update_fields=["unit_price", "updated_by", "version", "updated_at"])
    return material
