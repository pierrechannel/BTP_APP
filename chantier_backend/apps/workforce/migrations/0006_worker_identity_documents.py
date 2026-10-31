from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("workforce", "0005_timeentry_attendance")]
    operations = [
        migrations.AddField(model_name="worker", name="identity_document_front", field=models.FileField(blank=True, upload_to="workforce/identity/", verbose_name="Document d’identité — recto")),
        migrations.AddField(model_name="worker", name="identity_document_back", field=models.FileField(blank=True, upload_to="workforce/identity/", verbose_name="Document d’identité — verso")),
    ]
