import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

INTERNAL_STORE_URI = os.getenv("INTERNAL_STORE_URI")

class DBManager:
    def __init__(self):
        self.conn = psycopg2.connect(INTERNAL_STORE_URI)
        self.create_table()

    def create_table(self):
        with self.conn.cursor() as cur:
            # Main data table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS news_events (
                    id SERIAL PRIMARY KEY,
                    channel_handle TEXT,
                    internal_id BIGINT,
                    raw_text TEXT,
                    summary TEXT,
                    crime_type VARCHAR(50),
                    sub_category VARCHAR(100),
                    publish_date DATE,
                    publish_time TIME,
                    event_date DATE,
                    event_time TIME,
                    region VARCHAR(100),
                    township VARCHAR(100),
                    city VARCHAR(100),
                    location_name VARCHAR(255),
                    latitude FLOAT8,
                    longitude FLOAT8,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(channel_handle, internal_id)
                );
            """)
            # Migration: Standardize internal identifier
            cur.execute("""
                DO $$ 
                BEGIN 
                    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_events' AND column_name='telegram_id') THEN 
                        ALTER TABLE news_events RENAME COLUMN telegram_id TO internal_id; 
                    END IF; 
                END $$;
            """)
            # Migration: Add sub_category if it doesn't exist
            cur.execute("""
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_events' AND column_name='sub_category') THEN 
                        ALTER TABLE news_events ADD COLUMN sub_category VARCHAR(100); 
                    END IF; 
                END $$;
            """)
            # Configuration table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            self.conn.commit()

    def get_config(self, key, default=None):
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT value FROM system_config WHERE key = %s LIMIT 1;", (key,))
                row = cur.fetchone()
                return row[0] if row else default
        except Exception as e:
            print(f"Error fetching config {key}: {e}")
            return default

    def set_config(self, key, value):
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO system_config (key, value, updated_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
                """, (key, str(value)))
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error setting config {key}: {e}")
            return False

    def check_exists(self, channel_handle, internal_id):
        with self.conn.cursor() as cur:
            cur.execute("SELECT id FROM news_events WHERE channel_handle = %s AND internal_id = %s LIMIT 1;", (channel_handle, internal_id))
            return cur.fetchone() is not None

    def insert_news(self, data):
        # 1. Exact Duplicate by ID (Fast)
        if self.check_exists(data.get('channel_handle'), data.get('internal_id')):
            return False

        # 2. Content-based Duplicate (Semantic)
        check_query = """
            SELECT id FROM news_events 
            WHERE crime_type = %s AND location_name = %s AND event_date = %s
            LIMIT 1;
        """
        with self.conn.cursor() as cur:
            cur.execute(check_query, (data.get('crime_type'), data.get('location_name'), data.get('event_date')))
            if cur.fetchone():
                return False

            query = """
                INSERT INTO news_events (
                    channel_handle, internal_id, raw_text, summary, crime_type, sub_category,
                    publish_date, publish_time, event_date, event_time, 
                    region, township, city,
                    location_name, latitude, longitude
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (channel_handle, internal_id) DO NOTHING;
            """
            cur.execute(query, (
                data.get('channel_handle'),
                data.get('internal_id'),
                data.get('raw_text'),
                data.get('summary'),
                data.get('crime_type'),
                data.get('sub_category'),
                data.get('publish_date'),
                data.get('publish_time'),
                data.get('event_date'),
                data.get('event_time'),
                data.get('region'),
                data.get('township'),
                data.get('city'),
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
