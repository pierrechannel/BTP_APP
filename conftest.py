import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent / "chantier_backend"
sys.path.insert(0, str(BACKEND_DIR))
