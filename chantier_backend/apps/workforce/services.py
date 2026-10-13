from apps.workforce.models import TimeEntry
from apps.workforce.models import WorkerCertification


def validate_time_entry(time_entry: TimeEntry, user) -> TimeEntry:
    time_entry.is_validated = True
    time_entry.updated_by = user
    time_entry.version += 1
    time_entry.save(update_fields=["is_validated", "updated_by", "version", "updated_at"])
    return time_entry


def has_valid_certification(worker_certification: WorkerCertification, on_date) -> bool:
    if worker_certification.expires_at is None:
        return True
    return worker_certification.expires_at >= on_date
