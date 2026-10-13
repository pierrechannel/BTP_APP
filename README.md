# Chantier Backend

Backend Django/DRF pour l'application de gestion de chantiers BTP "Chantier".

## Demarrage local

Le developpement local utilise SQLite par defaut.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver
```

Tests:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.dev.txt
.\.venv\Scripts\pytest
```

Frontend React admin:

```powershell
cd chantier_frontend
npm install
npm run dev
```

Le frontend attend le backend sur `http://127.0.0.1:8000/api/v1`.

Compte demo cree par `seed_demo`:

- email: `admin@chantier.local`
- mot de passe: `ChangeMe123!`
- tenant: `Demo Burundi BTP`

API:

- `GET /api/v1/auth/me/`
- `POST /api/v1/auth/token/`
- `POST /api/v1/auth/token/refresh/`
- `POST /api/v1/auth/token/blacklist/`
- `/api/v1/projects/`
- `/api/docs/`

## Production

Installer les dependances production avec PostgreSQL:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.prod.txt
```

Puis configurer `DATABASE_URL` avec une URL PostgreSQL.
