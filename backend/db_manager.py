import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

class DBManager:
    def __init__(self):
        self.conn = psycopg2.connect(DATABASE_URL)
        self.create_table()

    def create_table(self):
        with self.conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS news_events (
                    id SERIAL PRIMARY KEY,
                    channel_handle TEXT,
                    telegram_id BIGINT,
                    raw_text TEXT,
                    summary TEXT,
                    crime_type VARCHAR(50),
                    publish_date DATE,
                    publish_time TIME,
                    event_date DATE,
                    event_time TIME,
                    location_name VARCHAR(255),
                    latitude FLOAT8,
                    longitude FLOAT8,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(channel_handle, telegram_id)
                );
            """)
            self.conn.commit()

    def insert_news(self, data):
        # Deduplication check: exists an event within similar location and same date/type?
        # For simple 'combine', we check if an event with same crime_type, location_name, and event_date exists
        check_query = """
            SELECT id FROM news_events 
            WHERE crime_type = %s AND location_name = %s AND event_date = %s
            LIMIT 1;
        """
        
        with self.conn.cursor() as cur:
            cur.execute(check_query, (data.get('crime_type'), data.get('location_name'), data.get('event_date')))
            existing = cur.fetchone()
            
            if existing:
                print(f"Match found for event! ID: {existing[0]}. Skipping duplicate or could update here.")
                # We can choose to update the record or just skip. 
                # User said "combine as a one", so if we already have it, we don't need another marker.
                # However, we still want to respect the unique telegram_id if it's from a different channel/msg.
                # Let's check telegram_id first to avoid Postgres error.
                cur.execute("SELECT id FROM news_events WHERE channel_handle = %s AND telegram_id = %s", 
                           (data.get('channel_handle'), data.get('telegram_id')))
                if cur.fetchone():
                    return # Truly already in DB

            query = """
                INSERT INTO news_events (
                    channel_handle, telegram_id, raw_text, summary, crime_type, 
                    publish_date, publish_time, event_date, event_time, 
                    location_name, latitude, longitude
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (channel_handle, telegram_id) DO NOTHING;
            """
            cur.execute(query, (
                data.get('channel_handle'),
                data.get('telegram_id'),
                data.get('raw_text'),
                data.get('summary'),
                data.get('crime_type'),
                data.get('publish_date'),
                data.get('publish_time'),
                data.get('event_date'),
                data.get('event_time'),
                data.get('location_name'),
                data.get('latitude'),
                data.get('longitude')
            ))
            self.conn.commit()

    def get_all_news(self):
        query = "SELECT * FROM news_events ORDER BY created_at DESC;"
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query)
            return cur.fetchall()
