from django.contrib import admin

from apps.documents.models import Document, DocumentVersion, Folder

admin.site.register(Folder)
admin.site.register(Document)
admin.site.register(DocumentVersion)
