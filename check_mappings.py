from backend.db_manager import DBManager
import os

db = DBManager()
if db.conn:
    with db.conn.cursor() as cur:
        # First ensure the table is updated by running the init
        db.create_source_mapping_table()
        
        # Then fetch all
        cur.execute("SELECT handle, display_name FROM source_mappings;")
        rows = cur.fetchall()
        print("Current Source Mappings in DB:")
        for row in rows:
            print(f"- {row[0]}: {row[1]}")
else:
    print("Could not connect to database.")
