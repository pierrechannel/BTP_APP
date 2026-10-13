from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AuditLog, Device, Membership, Role, Tenant, User
from apps.budget.models import Budget, BudgetLine, Expense
from apps.documents.models import Document, DocumentVersion, Folder
from apps.equipment.models import Equipment
from apps.notifications.models import Message, Notification
from apps.planning.models import Task
from apps.progress.models import DailyReport
from apps.projects.models import Lot, Project, ProjectStatusHistory, Stakeholder
from apps.qhse.models import CorrectiveAction, Incident
from apps.reports.models import ReportTemplate
from apps.resources.models import Material, Supplier
from apps.sync.models import SyncMutation
from apps.workforce.models import TimeEntry, Worker


class Command(BaseCommand):
    help = "Seed demo data for local development."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="admin@chantier.local")
        parser.add_argument("--password", default="ChangeMe123!")
        parser.add_argument("--tenant-slug", default="demo-burundi-btp")

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]
        tenant_slug = options["tenant_slug"]

        tenant, _ = Tenant.objects.update_or_create(
            slug=tenant_slug,
            defaults={
                "name": "Demo Burundi BTP",
                "default_currency": "BIF",
                "country": "BI",
                "is_active": True,
            },
        )

        roles = self.seed_roles(tenant)
        admin = self.seed_admin(email=email, password=password)
        Membership.objects.update_or_create(
            user=admin,
            tenant=tenant,
            defaults={"role": roles[Role.ADMIN], "is_active": True},
        )

        site_manager = self.seed_user(
            email="chef.chantier@chantier.local",
            username="chef_chantier",
            first_name="Jean",
            last_name="Nkurunziza",
            password=password,
        )
        Membership.objects.update_or_create(
            user=site_manager,
            tenant=tenant,
            defaults={"role": roles[Role.SITE_MANAGER], "is_active": True},
        )

        project = self.seed_project(tenant=tenant, user=admin)
        lots = self.seed_lots(tenant=tenant, user=admin, project=project)
        tasks = self.seed_tasks(tenant=tenant, user=admin, project=project, lots=lots)
        budget_lines = self.seed_budget(tenant=tenant, user=admin, project=project, lots=lots)
        self.seed_resources(tenant=tenant, user=admin)
        self.seed_workforce(tenant=tenant, user=admin, project=project, task=tasks["foundation"])
        self.seed_equipment(tenant=tenant, user=admin)
        self.seed_progress(tenant=tenant, user=admin, project=project)
        self.seed_qhse(tenant=tenant, user=admin, project=project)
        self.seed_documents(tenant=tenant, user=admin, project=project)
        self.seed_notifications(tenant=tenant, user=admin, project=project)
        self.seed_reports(tenant=tenant, user=admin)
        self.seed_sync(tenant=tenant, user=admin, project=project)
        self.seed_audit(tenant=tenant, user=admin, project=project)

        self.stdout.write(self.style.SUCCESS("Demo data ready."))
        self.stdout.write(f"Tenant: {tenant.name} ({tenant.id})")
        self.stdout.write(f"Admin: {email} / {password}")
        self.stdout.write(f"Project: {project.code} - {project.name}")
        self.stdout.write(f"Budget lines: {len(budget_lines)}")

    def seed_roles(self, tenant):
        labels = dict(Role.ROLE_CHOICES)
        roles = {}
        for code, name in labels.items():
            role, _ = Role.objects.update_or_create(
                tenant=tenant,
                code=code,
                defaults={
                    "name": name,
                    "permissions": self.permissions_for(code),
                },
            )
            roles[code] = role
        return roles

    def permissions_for(self, code):
        if code == Role.ADMIN:
            return {"*": ["create", "read", "update", "delete", "validate"]}
        if code == Role.SITE_MANAGER:
            return {
                "projects": ["read", "update"],
                "planning": ["create", "read", "update"],
                "progress": ["create", "read", "update", "validate"],
                "documents": ["create", "read", "update"],
            }
        if code == Role.WORKER:
            return {"planning": ["read"], "progress": ["create"], "workforce": ["create_own"]}
        if code == Role.CLIENT:
            return {"projects": ["read"], "progress": ["read"], "documents": ["read_shared"]}
        return {"projects": ["read"], "planning": ["read"], "documents": ["read"]}

    def seed_admin(self, email, password):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": "admin",
                "first_name": "Admin",
                "last_name": "Chantier",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        else:
            changed_fields = []
            if not user.is_staff:
                user.is_staff = True
                changed_fields.append("is_staff")
            if not user.is_superuser:
                user.is_superuser = True
                changed_fields.append("is_superuser")
            if changed_fields:
                user.save(update_fields=changed_fields)
        return user

    def seed_user(self, email, username, first_name, last_name, password):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user

    def seed_project(self, tenant, user):
        project, _ = Project.objects.update_or_create(
            tenant=tenant,
            code="CHANT-001",
            defaults={
                "name": "Construction ecole primaire - Gitega",
                "address": "Gitega, Burundi",
                "latitude": Decimal("-3.4264"),
                "longitude": Decimal("29.9306"),
                "client_name": "Commune de Gitega",
                "planned_start_date": date.today(),
                "planned_end_date": date.today() + timedelta(days=180),
                "work_type": "Batiment public",
                "contract_amount": Decimal("850000000.00"),
                "currency": "BIF",
                "status": Project.IN_PROGRESS,
                "created_by": user,
                "updated_by": user,
            },
        )
        ProjectStatusHistory.objects.get_or_create(
            tenant=tenant,
            project=project,
            from_status=Project.PREPARATION,
            to_status=Project.IN_PROGRESS,
            defaults={
                "reason": "Demarrage du chantier demo",
                "created_by": user,
                "updated_by": user,
            },
        )
        Stakeholder.objects.update_or_create(
            tenant=tenant,
            project=project,
            stakeholder_type=Stakeholder.CLIENT,
            name="Commune de Gitega",
            defaults={
                "email": "client@gitega.example",
                "phone": "+257 79 000 001",
                "created_by": user,
                "updated_by": user,
            },
        )
        return project

    def seed_lots(self, tenant, user, project):
        lot_specs = {
            "GO": ("Gros oeuvre", "Fondations, structure beton et maconnerie"),
            "ELEC": ("Electricite", "Reseaux electriques et tableaux"),
            "FIN": ("Finitions", "Enduits, peinture, menuiserie"),
        }
        lots = {}
        for code, (name, description) in lot_specs.items():
            lot, _ = Lot.objects.update_or_create(
                tenant=tenant,
                project=project,
                code=code,
                defaults={
                    "name": name,
                    "description": description,
                    "subcontractor_name": "Sous-traitant local" if code != "GO" else "",
                    "created_by": user,
                    "updated_by": user,
                },
            )
            lots[code] = lot
        return lots

    def seed_tasks(self, tenant, user, project, lots):
        task_specs = {
            "foundation": ("Fondations bloc A", lots["GO"], Task.IN_PROGRESS, 35),
            "walls": ("Elevation murs salles de classe", lots["GO"], Task.TODO, 0),
            "electrical": ("Reservation gaines electriques", lots["ELEC"], Task.TODO, 0),
        }
        tasks = {}
        for key, (name, lot, status, progress) in task_specs.items():
            task, _ = Task.objects.update_or_create(
                tenant=tenant,
                project=project,
                name=name,
                defaults={
                    "lot": lot,
                    "status": status,
                    "planned_start_date": date.today(),
                    "planned_end_date": date.today() + timedelta(days=30),
                    "progress_percent": progress,
                    "created_by": user,
                    "updated_by": user,
                },
            )
            tasks[key] = task
        return tasks

    def seed_budget(self, tenant, user, project, lots):
        budget, _ = Budget.objects.update_or_create(
            tenant=tenant,
            project=project,
            defaults={"currency": "BIF", "created_by": user, "updated_by": user},
        )
        line_specs = [
            (lots["GO"], "materiaux", "Ciment, fer a beton et agregats", Decimal("380000000.00")),
            (lots["GO"], "main_oeuvre", "Equipe gros oeuvre", Decimal("160000000.00")),
            (lots["ELEC"], "sous_traitance", "Travaux electricite", Decimal("95000000.00")),
            (lots["FIN"], "materiaux", "Peinture, menuiserie et finitions", Decimal("125000000.00")),
        ]
        lines = []
        for lot, category, label, amount in line_specs:
            line, _ = BudgetLine.objects.update_or_create(
                tenant=tenant,
                budget=budget,
                lot=lot,
                category=category,
                label=label,
                defaults={
                    "amount": amount,
                    "currency": "BIF",
                    "created_by": user,
                    "updated_by": user,
                },
            )
            lines.append(line)
        Expense.objects.update_or_create(
            tenant=tenant,
            budget_line=lines[0],
            date=date.today(),
            supplier_name="Cimenterie Demo",
            defaults={
                "amount_excluding_tax": Decimal("24000000.00"),
                "tax_amount": Decimal("4320000.00"),
                "amount_including_tax": Decimal("28320000.00"),
                "currency": "BIF",
                "status": Expense.VALIDATED,
                "created_by": user,
                "updated_by": user,
            },
        )
        return lines

    def seed_resources(self, tenant, user):
        Supplier.objects.update_or_create(
            tenant=tenant,
            name="Cimenterie Demo",
            defaults={"email": "vente@cimenterie.example", "phone": "+257 79 000 002"},
        )
        Material.objects.update_or_create(
            tenant=tenant,
            reference="CIM-42-5",
            defaults={
                "name": "Ciment 42.5",
                "unit": "sac",
                "unit_price": Decimal("38000.00"),
                "currency": "BIF",
                "created_by": user,
                "updated_by": user,
            },
        )
        Material.objects.update_or_create(
            tenant=tenant,
            reference="FER-12",
            defaults={
                "name": "Fer a beton diametre 12",
                "unit": "barre",
                "unit_price": Decimal("45000.00"),
                "currency": "BIF",
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_workforce(self, tenant, user, project, task):
        worker, _ = Worker.objects.update_or_create(
            tenant=tenant,
            first_name="Eric",
            last_name="Ndayishimiye",
            defaults={
                "job_title": "Macon",
                "hourly_rate": Decimal("4500.00"),
                "currency": "BIF",
                "created_by": user,
                "updated_by": user,
            },
        )
        TimeEntry.objects.update_or_create(
            tenant=tenant,
            worker=worker,
            project=project,
            task=task,
            work_date=date.today(),
            defaults={
                "normal_hours": Decimal("8.00"),
                "overtime_hours": Decimal("1.50"),
                "is_validated": True,
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_equipment(self, tenant, user):
        Equipment.objects.update_or_create(
            tenant=tenant,
            serial_number="MIX-DEMO-001",
            defaults={
                "name": "Betonniere 350L",
                "equipment_type": "Betonniere",
                "state": "operationnel",
                "daily_cost": Decimal("65000.00"),
                "currency": "BIF",
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_progress(self, tenant, user, project):
        DailyReport.objects.update_or_create(
            tenant=tenant,
            project=project,
            report_date=date.today(),
            defaults={
                "weather": "Ensoleille",
                "work_done": "Implantation terminee et coulage partiel des semelles.",
                "difficulties": "Approvisionnement en gravier a surveiller.",
                "status": DailyReport.SUBMITTED,
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_qhse(self, tenant, user, project):
        incident, _ = Incident.objects.update_or_create(
            tenant=tenant,
            project=project,
            title="EPI manquant sur zone fondations",
            defaults={
                "description": "Un intervenant a ete observe sans lunettes de protection.",
                "occurred_at": timezone.now(),
                "status": Incident.ACTIONS,
                "created_by": user,
                "updated_by": user,
            },
        )
        CorrectiveAction.objects.update_or_create(
            tenant=tenant,
            incident=incident,
            title="Rappel securite et distribution EPI",
            defaults={
                "due_date": date.today() + timedelta(days=2),
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_documents(self, tenant, user, project):
        folder, _ = Folder.objects.update_or_create(
            tenant=tenant,
            project=project,
            parent=None,
            name="Plans",
            defaults={"created_by": user, "updated_by": user},
        )
        document, _ = Document.objects.update_or_create(
            tenant=tenant,
            folder=folder,
            title="Plan fondations bloc A",
            defaults={
                "status": Document.APPROVED,
                "created_by": user,
                "updated_by": user,
            },
        )
        DocumentVersion.objects.update_or_create(
            tenant=tenant,
            document=document,
            version_label="A",
            defaults={
                "file": "documents/demo-plan-fondations.pdf",
                "original_name": "plan-fondations-bloc-a.pdf",
                "mime_type": "application/pdf",
                "size": 245760,
                "checksum": "demo-checksum",
                "is_current": True,
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_notifications(self, tenant, user, project):
        Notification.objects.update_or_create(
            tenant=tenant,
            user=user,
            title="Budget chantier a 80%",
            defaults={
                "body": "Le seuil de suivi budgetaire approche pour CHANT-001.",
                "created_by": user,
                "updated_by": user,
            },
        )
        Message.objects.update_or_create(
            tenant=tenant,
            project=project,
            sender=user,
            body="Merci de valider le rapport journalier avant 17h.",
            defaults={"created_by": user, "updated_by": user},
        )

    def seed_reports(self, tenant, user):
        ReportTemplate.objects.update_or_create(
            tenant=tenant,
            code="PROJECT_DASHBOARD",
            defaults={
                "name": "Tableau de bord chantier",
                "definition": {
                    "widgets": ["progress", "budget", "incidents", "documents"],
                    "currency": "BIF",
                },
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_sync(self, tenant, user, project):
        device, _ = Device.objects.update_or_create(
            tenant=tenant,
            user=user,
            name="Telephone demo",
            defaults={
                "platform": "android",
                "push_token": "",
                "last_seen_at": timezone.now(),
                "is_active": True,
            },
        )
        SyncMutation.objects.update_or_create(
            tenant=tenant,
            client_mutation_id=UUID("11111111-1111-4111-8111-111111111111"),
            defaults={
                "device": device,
                "resource_type": "progress.daily_report",
                "resource_id": project.id,
                "operation": "upsert",
                "payload": {"project_code": project.code, "source": "seed"},
                "status": "applied",
                "created_by": user,
                "updated_by": user,
            },
        )

    def seed_audit(self, tenant, user, project):
        AuditLog.objects.get_or_create(
            tenant=tenant,
            user=user,
            action="seed_demo",
            resource_type="projects.Project",
            resource_id=str(project.id),
            defaults={
                "correlation_id": "seed-demo",
                "metadata": {"project_code": project.code},
            },
        )
