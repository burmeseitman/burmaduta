import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def migrate_db():
    DATABASE_URL = os.getenv("DATABASE_URL")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True # Avoid open transactions holding locks
        with conn.cursor() as cur:
            print("Settings lock_timeout...")
            cur.execute("SET lock_timeout = '10s';")
            
            print("Adding region column...")
            try:
                cur.execute("ALTER TABLE news_events ADD COLUMN region VARCHAR(100);")
                print("Added column: region")
            except Exception as e:
                print(f"Region exists or error: {e}")
            
            print("Adding township column...")
            try:
                cur.execute("ALTER TABLE news_events ADD COLUMN township VARCHAR(100);")
                print("Added column: township")
            except Exception as e:
                print(f"Township exists or error: {e}")
            
            print("Adding city column...")
            try:
                cur.execute("ALTER TABLE news_events ADD COLUMN city VARCHAR(100);")
                print("Added column: city")
            except Exception as e:
                print(f"City exists or error: {e}")
                
        conn.close()
        print("Migration complete.")
    except Exception as e:
        print(f"Critical error: {e}")

if __name__ == "__main__":
    migrate_db()
