from corsheaders.defaults import default_headers

from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["*"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
CORS_ALLOWED_ORIGINS = list(dict.fromkeys([
    *CORS_ALLOWED_ORIGINS,
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "https://btp-app-rouge.vercel.app",
]))
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://localhost:\d+$",
    r"^http://127\.0\.0\.1:\d+$",
]
CORS_ALLOW_HEADERS = list(default_headers) + [
    "x-tenant-id",
    "if-match",
]
