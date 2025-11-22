import os
from supabase import create_client, Client
from dotenv import load_dotenv
from psycopg_pool import AsyncConnectionPool

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY") # Must be the Service Role Key

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file")

# 1. Standard Supabase Client (for general queries)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Postgres Connection String (required for LangGraph Checkpointer)
# We construct the connection string from the Supabase URL logic
# Standard Supabase DB URL format: postgres://postgres.[project-ref]:[password]@[region].pooler.supabase.com:6543/postgres
# BUT for the Python backend, we often use the direct connection string.
# Let's use the direct connection string format.
# YOU MUST UPDATE 'YOUR_DB_PASSWORD' in the function below or add DB_URI to .env
DB_URI = os.getenv("DB_URI") 

# If DB_URI isn't in .env, we try to construct it (risky if password isn't set)
# It is BETTER to add DB_URI to your .env file.