import os
import sys

# Add parent directory to sys.path so modules like main, database, etc. can be imported
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from database import init_db
from main import app

# Ensure database tables exist upon cold start
try:
    init_db()
except Exception:
    pass

# Export app and handler for Vercel serverless functions
app = app
handler = app
