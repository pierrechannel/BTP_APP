from apps.equipment.models import Equipment


def update_equipment_state(equipment: Equipment, state: str, user) -> Equipment:
    equipment.state = state
    equipment.updated_by = user
    equipment.version += 1
    equipment.save(update_fields=["state", "updated_by", "version", "updated_at"])
    return equipment
