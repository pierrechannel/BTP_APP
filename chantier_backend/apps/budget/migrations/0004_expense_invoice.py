from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("budget", "0003_amendment_archived_at_budget_archived_at_and_more")]
    operations = [migrations.AddField(model_name="expense", name="invoice", field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="expense", to="budget.invoice"))]
