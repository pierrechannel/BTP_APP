#!/usr/bin/env python
import os
from pathlib import Path
import sys


def main() -> None:
    project_dir = Path(__file__).resolve().parent / "chantier_backend"
    sys.path.insert(0, str(project_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
