from django.utils import timezone

from apps.qhse.models import CorrectiveAction, Incident


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
