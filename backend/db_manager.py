import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
# Load .env from project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

INTERNAL_STORE_URI = os.getenv("INTERNAL_STORE_URI")

class DBManager:
    def __init__(self):
        if not INTERNAL_STORE_URI:
            print("❌ Error: INTERNAL_STORE_URI not found in environment.")
            return

        try:
            self.conn = psycopg2.connect(INTERNAL_STORE_URI)
            self.create_source_mapping_table() # Ensure mapping table exists
            print("✅ Database connection established.")
        except Exception as e:
            print(f"❌ Database Connection Error: {e}")
            raise e

    def _ensure_connection(self):
        """Checks if connection is alive and reconnects if needed."""
        if not self.conn or self.conn.closed != 0:
            print("🔄 DB Connection lost. Reconnecting...")
            self.conn = psycopg2.connect(INTERNAL_STORE_URI)
            return

        try:
            # Poll the connection to ensure it's still healthy
            with self.conn.cursor() as cur:
                cur.execute("SELECT 1;")
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            print("🔄 DB Connection stale. Reconnecting...")
            self.conn = psycopg2.connect(INTERNAL_STORE_URI)

    def create_table(self):
        # Configuration for migration transparency
        TABLE = 'news_events'
        
        with self.conn.cursor() as cur:
            cur.execute("SET lock_timeout = '5s';")
            
            # 1. Main Table
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {TABLE} (
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
            self.conn.commit()

            # 2. System Config Table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS system_config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
            self.conn.commit()

            # 3. Optimization Indexes (Speed up filtering and sorting)
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_publish_date ON {TABLE} (publish_date);")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_crime_type ON {TABLE} (crime_type);")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_region ON {TABLE} (region);")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_township ON {TABLE} (township);")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_city ON {TABLE} (city);")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_channel_handle ON {TABLE} (channel_handle);")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_created_at ON {TABLE} (created_at DESC);")
            self.conn.commit()
            print(f"✅ Optimization indexes ensured for {TABLE}.")

        # 4. Migrations (Independent transactions to avoid aborted state)
        def check_col(col):
            with self.conn.cursor() as cur:
                # Explicitly check current schema to avoid issues with search_path
                cur.execute("SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = %s AND column_name = %s", (TABLE, col))
                return cur.fetchone() is not None

        # Rename source_id -> internal_id
        if check_col('telegram_id') and not check_col('internal_id'):
            try:
                with self.conn.cursor() as cur:
                    print(f"🔄 Migration: Renaming source_id to internal_id in {TABLE}...")
                    cur.execute(f"ALTER TABLE {TABLE} RENAME COLUMN telegram_id TO internal_id;")
                    self.conn.commit()
                    print(f"✅ Migration successful: Renamed source_id to internal_id in {TABLE}.")
            except Exception as e:
                self.conn.rollback()
                print(f"❌ Migration failed: Renaming source_id to internal_id in {TABLE}. Error: {e}")
        elif check_col('telegram_id') and check_col('internal_id'):
            print(f"ℹ️ Migration skipped: Both source_id and internal_id exist in {TABLE}.")
        else:
            print(f"ℹ️ Migration skipped: legacy source_id column not found in {TABLE}.")


        # Add sub_category
        if not check_col('sub_category'):
            try:
                with self.conn.cursor() as cur:
                    print(f"🔄 Migration: Adding sub_category column to {TABLE}...")
                    cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN sub_category VARCHAR(100);")
                    self.conn.commit()
                    print(f"✅ Migration successful: Added sub_category column to {TABLE}.")
            except Exception as e:
                self.conn.rollback()
                print(f"❌ Migration failed: Adding sub_category column to {TABLE}. Error: {e}")
        else:
            print(f"ℹ️ Migration skipped: sub_category column already exists in {TABLE}.")

    def create_source_mapping_table(self):
        """Creates the source_mappings table and populates initial values."""
        try:
            with self.conn.cursor() as cur:
                # 1. Create table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS source_mappings (
                        handle TEXT PRIMARY KEY,
                        display_name TEXT NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                
                # 2. Populate initial values provided by user
                mappings = [
                    ('@khitthitnews', 'Khit Thit'),
                    ('@elevenmediagroup', 'Verified News Agency'),
                    ('@peoplespring', 'People Spring'),
                    ('@bbcnewsburmese', 'BBC Burmese'),
                    ('@theirrawaddy', 'The Irrawaddy'),
                    ('@spmnewsagency2019', 'Shwe Phee Myay'),
                    ('@infohlaing', 'Hlaing Info'),
                    ('@mizzimatv', 'Mizzima TV'),
                    ('@dvbburmese', 'DVB Burmese'),
                    ('@rfaburmese', 'RFA Burmese'),
                    ('@voaburmese', 'VOA Burmese'),
                    ('@chandalinn', 'Chan Da Linn')
                ]
                
                for handle, name in mappings:
                    cur.execute("""
                        INSERT INTO source_mappings (handle, display_name)
                        VALUES (%s, %s)
                        ON CONFLICT (handle) DO NOTHING;
                    """, (handle, name))
                
                self.conn.commit()
                print("✅ Source mapping table checked/updated.")
        except Exception as e:
            print(f"❌ Error creating/populating source_mappings: {e}")
            self.conn.rollback()

    def get_config(self, key, default=None):
        self._ensure_connection()
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT value FROM system_config WHERE key = %s LIMIT 1;", (key,))
                row = cur.fetchone()
                return row[0] if row else default
        except Exception as e:
            print(f"Error fetching config {key}: {e}")
            return default

    def set_config(self, key, value):
        self._ensure_connection()
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
        self._ensure_connection()
        with self.conn.cursor() as cur:
            cur.execute("SELECT id FROM news_events WHERE channel_handle = %s AND internal_id = %s LIMIT 1;", (channel_handle, internal_id))
            return cur.fetchone() is not None

    def insert_news_batch(self, news_items):
        """
        Inserts a list of news items in a single transaction.
        Handles both exact ID deduplication and semantic deduplication.
        """
        if not news_items:
            return 0
        
        self._ensure_connection()
        inserted_count = 0
        try:
            with self.conn.cursor() as cur:
                for data in news_items:
                    query = """
                        INSERT INTO news_events (
                            channel_handle, internal_id, raw_text, summary, crime_type, sub_category,
                            publish_date, publish_time, event_date, event_time, 
                            region, township, city,
                            location_name, latitude, longitude
                        ) 
                        SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                        WHERE NOT EXISTS (
                            SELECT 1 FROM news_events 
                            WHERE (channel_handle = %s AND internal_id = %s)
                            OR (
                                crime_type = %s AND event_date = %s::DATE 
                                AND COALESCE(city, '') = COALESCE(%s, '')
                                AND COALESCE(township, '') = COALESCE(%s, '')
                                AND COALESCE(sub_category, '') = COALESCE(%s, '')
                                AND (city IS NOT NULL OR township IS NOT NULL)
                            )
                        )
                        ON CONFLICT (channel_handle, internal_id) DO NOTHING;
                    """
                    
                    params = (
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
                        data.get('longitude'),
                        # For the WHERE NOT EXISTS clause (ID check)
                        data.get('channel_handle'),
                        data.get('internal_id'),
                        # For the WHERE NOT EXISTS clause (Semantic check)
                        data.get('crime_type'),
                        data.get('event_date'),
                        data.get('city'),
                        data.get('township'),
                        data.get('sub_category')
                    )
                    
                    cur.execute(query, params)
                    if cur.rowcount > 0:
                        inserted_count += 1
                
                self.conn.commit()
                return inserted_count
        except Exception as e:
            print(f"Error in batch insert: {e}")
            self.conn.rollback()
            return 0

    def insert_news(self, data):
        """Single insert wrapper around batch insert."""
        return self.insert_news_batch([data]) > 0

    def get_all_news(self):
        self._ensure_connection()
        query = """
            SELECT n.*, COALESCE(s.display_name, n.channel_handle) as source_name
            FROM news_events n
            LEFT JOIN source_mappings s ON LOWER(n.channel_handle) = LOWER(s.handle)
            ORDER BY n.created_at DESC;
        """
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query)
            return cur.fetchall()
