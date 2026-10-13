from django.utils import timezone

from apps.qhse.models import CorrectiveAction, Incident, Inspection


def close_incident(incident: Incident, user) -> Incident:
    incident.status = Incident.CLOSED
    incident.updated_by = user
    incident.version += 1
    incident.save(update_fields=["status", "updated_by", "version", "updated_at"])
    return incident


def complete_action(action: CorrectiveAction, user) -> CorrectiveAction:
    action.completed_at = timezone.now()
    action.updated_by = user
    action.version += 1
    action.save(update_fields=["completed_at", "updated_by", "version", "updated_at"])
    return action


def complete_inspection(inspection: Inspection, user) -> Inspection:
    inspection.status = Inspection.COMPLETED
    total = inspection.inspection_items.count()
    compliant = inspection.inspection_items.filter(is_compliant=True).count()
    inspection.score = (compliant / total * 100) if total else None
    inspection.updated_by = user
    inspection.version += 1
    inspection.save(update_fields=["status", "score", "updated_by", "version", "updated_at"])
    return inspection
