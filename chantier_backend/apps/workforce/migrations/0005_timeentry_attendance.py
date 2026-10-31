from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("workforce", "0004_assignment_archived_at_certification_archived_at_and_more")]
    operations = [
        migrations.AddField(model_name="timeentry", name="attendance_status", field=models.CharField(blank=True, max_length=10, choices=[("present", "Présent"), ("late", "Retard"), ("absent", "Absent")])),
        migrations.AddField(model_name="timeentry", name="arrival_time", field=models.TimeField(blank=True, null=True)),
        migrations.AddField(model_name="timeentry", name="departure_time", field=models.TimeField(blank=True, null=True)),
    ]
