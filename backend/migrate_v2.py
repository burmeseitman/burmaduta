import os
import sys
from db_manager import DBManager

def run_migration():
    print("🚀 Starting Dedicated Database Migration...")
    try:
        db = DBManager()
        # Set a longer lock timeout for human-initiated migrations
        with db.conn.cursor() as cur:
            cur.execute("SET lock_timeout = '20s';")
            print("⏳ Lock timeout increased to 20s. Please ensure no other clients are accessing the 'news_events' table.")
            
        db.create_table()
        print("\n🏁 Migration Success!")
    except Exception as e:
        print(f"\n❌ Migration Failed: {e}")
        print("\nTIP: If it still fails with 'lock timeout', try stopping the running api.py or scraper.py.")

if __name__ == "__main__":
    run_migration()
