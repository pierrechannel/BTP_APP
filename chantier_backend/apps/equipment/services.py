from apps.equipment.models import Equipment
from rest_framework.exceptions import ValidationError


def update_equipment_state(equipment: Equipment, state: str, user) -> Equipment:
    if state not in {"operationnel", "maintenance", "en_panne", "hors_service"}:
        raise ValidationError({"state": "Etat du materiel invalide."})
    equipment.state = state
    equipment.updated_by = user
    equipment.version += 1
    equipment.save(update_fields=["state", "updated_by", "version", "updated_at"])
    return equipment
