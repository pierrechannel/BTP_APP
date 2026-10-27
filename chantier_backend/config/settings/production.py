from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

if (len(SECRET_KEY) < 32 or SECRET_KEY.startswith("django-insecure-")  # noqa: F405
        or SECRET_KEY == "change-me"):  # noqa: F405
    raise ImproperlyConfigured("DJANGO_SECRET_KEY doit contenir un secret aleatoire d'au moins 32 caracteres.")
if not ALLOWED_HOSTS:  # noqa: F405
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS doit etre configure en production.")
if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":  # noqa: F405
    raise ImproperlyConfigured("DATABASE_URL doit designer une base PostgreSQL en production.")

DEBUG = False
REPORTS_ASYNC = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405
