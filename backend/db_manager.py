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
        self.conn = None
        if not INTERNAL_STORE_URI:
            print("❌ Error: INTERNAL_STORE_URI not found in environment.")
            return

        try:
            self.conn = psycopg2.connect(INTERNAL_STORE_URI)
            print("✅ Database connection established.")
        except Exception as e:
            print(f"❌ Database Connection Error: {e}")
            # We don't raise here to allow the object to exist, 
            # but subsequent calls will try to reconnect.
            self.conn = None

    def _ensure_connection(self):
        """Checks if connection is alive and reconnects if needed."""
        if not self.conn or (hasattr(self.conn, 'closed') and self.conn.closed != 0):
            if not INTERNAL_STORE_URI:
                print("❌ Cannot reconnect: INTERNAL_STORE_URI missing.")
                return 
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
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_channel_handle_lower ON {TABLE} (LOWER(channel_handle));")
            cur.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_created_at ON {TABLE} (created_at DESC);")
            
            # 4. Source Mappings Indexes
            cur.execute("CREATE INDEX IF NOT EXISTS idx_source_mappings_handle_lower ON source_mappings (LOWER(handle));")

            # 5. Content Uniqueness Index (MD5-based to handle large text)
            cur.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS idx_{TABLE}_raw_text_unique ON {TABLE} (MD5(raw_text));")
            
            self.conn.commit()
            print(f"✅ Optimization and Unique indexes ensured for {TABLE}.")


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

    def ensure_tables(self):
        """Creates required tables if they don't exist. Does NOT populate data auto."""
        try:
            with self.conn.cursor() as cur:
                # 1. Source Mappings Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS source_mappings (
                        handle TEXT PRIMARY KEY,
                        display_name TEXT NOT NULL,
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                self.conn.commit()
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            self.conn.rollback()

    def get_config(self, key, default=None):
        self._ensure_connection()
        if not self.conn:
            return default
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
        if not self.conn:
            return False
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

    def check_exists(self, channel_handle, internal_id, raw_text=None):
        self._ensure_connection()
        if not self.conn:
            return False
        with self.conn.cursor() as cur:
            # First check by ID
            cur.execute("SELECT id FROM news_events WHERE channel_handle = %s AND internal_id = %s LIMIT 1;", (channel_handle, internal_id))
            if cur.fetchone():
                return True
            
            # Then check by exact raw_text (MD5 indexed)
            if raw_text:
                cur.execute("SELECT id FROM news_events WHERE MD5(raw_text) = MD5(%s) AND raw_text = %s LIMIT 1;", (raw_text, raw_text))
                return cur.fetchone() is not None
                
            return False

    def insert_news_batch(self, news_items):
        """
        Inserts a list of news items in a single transaction.
        Handles both exact ID deduplication and semantic deduplication.
        """
        if not news_items:
            return 0
        
        self._ensure_connection()
        if not self.conn:
            return 0
            
        def is_valid_date(date_str):
            if not date_str: return False
            try:
                from datetime import datetime
                datetime.strptime(str(date_str), '%Y-%m-%d')
                return True
            except:
                return False

        inserted_count = 0
        try:
            with self.conn.cursor() as cur:
                for data in news_items:
                    # Validate event_date before insertion
                    event_date = data.get('event_date')
                    if not is_valid_date(event_date):
                        # print(f"⚠️ Invalid event_date detected: {event_date}. Setting to None.")
                        data['event_date'] = None

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
                            OR (MD5(raw_text) = MD5(%s) AND raw_text = %s) -- Efficient exact text deduplication using index
                            OR (
                                crime_type = %s AND (event_date = %s::DATE OR %s::DATE IS NULL) 
                                AND (
                                    (COALESCE(city, '') = COALESCE(%s, '') AND COALESCE(township, '') = COALESCE(%s, ''))
                                    OR (COALESCE(location_name, '') = COALESCE(%s, ''))
                                )
                                -- If location or sub-category matches, and date/type match, it's likely a duplicate
                                AND (
                                    COALESCE(sub_category, '') = COALESCE(%s, '') 
                                    OR (
                                        (city IS NOT NULL OR township IS NOT NULL) 
                                        AND (city = %s OR township = %s)
                                    )
                                )
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
                        # For the WHERE NOT EXISTS clause (Text check)
                        data.get('raw_text'),
                        data.get('raw_text'),
                        # For the WHERE NOT EXISTS clause (Semantic check)
                        data.get('crime_type'),
                        data.get('event_date'),
                        data.get('event_date'), # New parameter for NULL check
                        data.get('city'),
                        data.get('township'),
                        data.get('location_name'),
                        data.get('sub_category'),
                        data.get('city'),
                        data.get('township')
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

    def get_all_news(self, include_raw=False, days=90):
        self._ensure_connection()
        if not self.conn:
            return []

        # Defense-in-depth: ensure days is a safe integer
        try:
            days = int(days)
            if days < 1:
                days = 1
            elif days > 365:
                days = 365
        except (ValueError, TypeError):
            days = 90

        # Define all columns EXCEPT large fields like raw_text by default
        columns = [
            "n.id", "n.channel_handle", "n.internal_id", "n.summary", "n.crime_type",
            "n.sub_category", "n.publish_date", "n.publish_time", "n.event_date",
            "n.event_time", "n.region", "n.township", "n.city", "n.location_name",
            "n.latitude", "n.longitude", "n.created_at"
        ]
        if include_raw:
            columns.append("n.raw_text")

        columns_str = ", ".join(columns)
        
        # SECURITY FIX: Use parameterized query instead of f-string interpolation
        params = []
        where_clause = ""
        if days:
            where_clause = "WHERE n.created_at >= NOW() - INTERVAL %s"
            params.append(f"{days} days")

        query = f"""
            SELECT {columns_str}, COALESCE(s.display_name, n.channel_handle) as source_name
            FROM news_events n
            LEFT JOIN source_mappings s ON LOWER(n.channel_handle) = LOWER(s.handle)
            {where_clause}
            ORDER BY n.created_at DESC;
        """
        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params if params else None)
            return cur.fetchall()


    def get_monitored_channels(self):
        """Fetches all channel handles from source_mappings table to use as INPUT_CHANNELS."""
        self._ensure_connection()
        if not self.conn:
            return []
        try:
            with self.conn.cursor() as cur:
                cur.execute("SELECT handle FROM source_mappings;")
                rows = cur.fetchall()
                # Return list of strings, e.g., ['@channel1', '@channel2']
                return [row[0].strip() for row in rows if row[0]]
        except Exception as e:
            print(f"Error fetching monitored channels: {e}")
            return []
