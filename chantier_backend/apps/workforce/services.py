from apps.workforce.models import TimeEntry


def validate_time_entry(time_entry: TimeEntry, user) -> TimeEntry:
    time_entry.is_validated = True
    time_entry.updated_by = user
    time_entry.version += 1
    time_entry.save(update_fields=["is_validated", "updated_by", "version", "updated_at"])
    return time_entry
