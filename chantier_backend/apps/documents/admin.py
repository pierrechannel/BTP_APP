from django.contrib import admin

from apps.documents.models import ApprovalWorkflow, Document, DocumentAcl, DocumentVersion, Folder

admin.site.register(Folder)
admin.site.register(Document)
admin.site.register(DocumentVersion)
admin.site.register(DocumentAcl)
admin.site.register(ApprovalWorkflow)
