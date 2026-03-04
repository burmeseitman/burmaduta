import os
from dotenv import load_dotenv
from db_manager import DBManager

# Mapping from .env keys to generic table keys
KEY_MAPPING = {
    "SOURCE_API_ID": "API_ID",
    "SOURCE_API_HASH": "API_HASH",
    "SOURCE_CHANNELS": "INPUT_CHANNELS",
    "FETCH_LIMIT": "FETCH_LIMIT",
    "PROCESSOR_KEY": "PROCESSOR_KEY",
    "AI_PROMPT": "AI_PROMPT"
}

def migrate():
    load_dotenv()
    db = DBManager()
    
    print("🚀 Starting Configuration Migration...")
    
    for env_key, table_key in KEY_MAPPING.items():
        val = os.getenv(env_key)
        if val:
            db.set_config(table_key, val)
            print(f"✅ Migrated: {env_key} ➔ {table_key}")
        else:
            print(f"⚠️ Warning: {env_key} not found in .env")
            
    print("\n🏁 Migration Complete! Keys are now available in 'system_config' table.")

if __name__ == "__main__":
    migrate()
