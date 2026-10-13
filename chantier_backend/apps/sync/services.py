from apps.sync.models import SyncMutation


def mark_mutation_applied(mutation: SyncMutation, user) -> SyncMutation:
    mutation.status = "applied"
    mutation.error = {}
    mutation.updated_by = user
    mutation.version += 1
    mutation.save(update_fields=["status", "error", "updated_by", "version", "updated_at"])
    return mutation


def mark_mutation_failed(mutation: SyncMutation, error: dict, user) -> SyncMutation:
    mutation.status = "failed"
    mutation.error = error
    mutation.updated_by = user
    mutation.version += 1
    mutation.save(update_fields=["status", "error", "updated_by", "version", "updated_at"])
    return mutation
