import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
# Load .env from project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

INTERNAL_STORE_URI = os.getenv("INTERNAL_STORE_URI")

class DBManager:
    # In-memory store for local mock testing if DB connection fails
    _mock_data = {
        "users": {},
        "user_sessions": {},
        "news_comments": {},
        "conflict_forecasts": [],
        "news_events": [
            {
                "id": 1,
                "channel_handle": "@burma_duta_mock",
                "internal_id": 1001,
                "summary": "ဗမာဒူတ နယူးဖိဒ် တိုက်ရိုက်စနစ် local test verification update. ဖြစ်စဉ်မှတ်တမ်းများအား dynamic categorizations filtering ဖြင့် ဤဖိဒ်တွင် လွယ်ကူစွာ ဖတ်ရှုနိုင်ပါသည်။",
                "crime_type": "စစ်ရေးသတင်း",
                "sub_category": "ပစ်ခတ်မှု",
                "publish_date": "2026-07-18",
                "publish_time": "12:00:00",
                "event_date": "2026-07-18",
                "event_time": "12:00:00",
                "region": "ရန်ကုန်",
                "township": "ကမာရွတ်",
                "city": "ရန်ကုန်",
                "location_name": "ကမာရွတ်",
                "latitude": 16.82,
                "longitude": 96.13,
                "heading": "သတင်းအချက်အလက်",
                "target_location": "ရန်ကုန်",
                "created_at": None, # Will be set to current time
                "source_name": "BurmaDuta Mobile"
            },
            {
                "id": 2,
                "channel_handle": "@crime_records_mock",
                "internal_id": 1002,
                "summary": "မှုခင်းဖြစ်စဉ် သတင်းအချက်အလက် - ရန်ကုန်တိုင်းအတွင်း ဆိုင်ကယ်ခိုးယူမှုများ မကြာခဏ ဖြစ်ပွားနေသဖြင့် သတိပြုကြရန်။",
                "crime_type": "မှုခင်းသတင်း",
                "sub_category": "ခိုးယူမှု",
                "publish_date": "2026-07-18",
                "publish_time": "14:30:00",
                "event_date": "2026-07-18",
                "event_time": "14:30:00",
                "region": "ရန်ကုန်",
                "township": "လှိုင်",
                "city": "ရန်ကုန်",
                "location_name": "လှိုင်",
                "latitude": 16.84,
                "longitude": 96.12,
                "heading": "သတင်းအချက်အလက်",
                "target_location": "လှိုင်မြို့နယ်",
                "created_at": None,
                "source_name": "Crime Records MM"
            }
        ]
    }

    def __init__(self):
        self.conn = None
        self.mock_mode = False
        
        # Populate dynamic mock times
        from datetime import datetime, timezone
        for item in DBManager._mock_data["news_events"]:
            if item["created_at"] is None:
                item["created_at"] = datetime.now(timezone.utc)

        if not INTERNAL_STORE_URI:
            print("⚠️ Warning: INTERNAL_STORE_URI not found. Fallback to local memory mock mode...")
            self.mock_mode = True
            return

        try:
            self.conn = psycopg2.connect(INTERNAL_STORE_URI)
            print("✅ Database connection established.")
            # Automatically run migrations and ensure tables exist
            self.create_table()
            self.ensure_tables()
        except Exception as e:
            print(f"⚠️ Database Connection Error: {e}. Fallback to In-Memory Local Dev Mock Mode for testing...")
            self.mock_mode = True
            self.conn = None

    def _ensure_connection(self):
        """Checks if connection is alive and reconnects if needed."""
        if self.mock_mode:
            return

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
                    heading VARCHAR(50),
                    target_location VARCHAR(255),
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

        # Add heading and target_location
        if not check_col('heading'):
            try:
                with self.conn.cursor() as cur:
                    print(f"🔄 Migration: Adding heading and target_location columns to {TABLE}...")
                    cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN heading VARCHAR(50);")
                    cur.execute(f"ALTER TABLE {TABLE} ADD COLUMN target_location VARCHAR(255);")
                    self.conn.commit()
                    print(f"✅ Migration successful: Added heading and target_location columns to {TABLE}.")
            except Exception as e:
                self.conn.rollback()
                print(f"❌ Migration failed: Adding heading/target_location columns to {TABLE}. Error: {e}")

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
                # 2. Users Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                # 3. User Sessions Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS user_sessions (
                        token TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        expires_at TIMESTAMPTZ NOT NULL
                    );
                """)
                # 4. News Comments Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS news_comments (
                        id SERIAL PRIMARY KEY,
                        news_id INTEGER NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        username VARCHAR(50) NOT NULL,
                        comment_text TEXT NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """)
                # Indexes for comment optimization
                cur.execute("CREATE INDEX IF NOT EXISTS idx_news_comments_news_id ON news_comments (news_id);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (token);")
                
                # 5. Conflict Forecasts Table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS conflict_forecasts (
                        id SERIAL PRIMARY KEY,
                        township VARCHAR(255) NOT NULL,
                        forecast_date DATE NOT NULL,
                        predicted_count REAL NOT NULL,
                        trend VARCHAR(50) NOT NULL,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        UNIQUE(township, forecast_date)
                    );
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_conflict_forecasts_township ON conflict_forecasts (township);")
                cur.execute("CREATE INDEX IF NOT EXISTS idx_conflict_forecasts_date ON conflict_forecasts (forecast_date);")

                self.conn.commit()
                print("✅ Users, Sessions, Comments, and Forecasts schema ensured.")
        except Exception as e:
            print(f"❌ Error creating tables: {e}")
            self.conn.rollback()

    # --- User Management DB Methods ---
    def create_user(self, username, password_hash):
        if self.mock_mode:
            user_id = len(DBManager._mock_data["users"]) + 1
            DBManager._mock_data["users"][user_id] = {
                "id": user_id,
                "username": username,
                "password_hash": password_hash,
                "created_at": "2026-07-18T12:00:00+00:00"
            }
            return user_id

        self._ensure_connection()
        if not self.conn:
            return False
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id;",
                    (username, password_hash)
                )
                user_id = cur.fetchone()[0]
                self.conn.commit()
                return user_id
        except Exception as e:
            print(f"Error creating user {username}: {e}")
            self.conn.rollback()
            return False

    def get_user_by_username(self, username):
        if self.mock_mode:
            for uid, user in DBManager._mock_data["users"].items():
                if user["username"].lower() == username.lower():
                    return user
            return None

        self._ensure_connection()
        if not self.conn:
            return None
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT id, username, password_hash, created_at FROM users WHERE username = %s LIMIT 1;", (username,))
                return cur.fetchone()
        except Exception as e:
            print(f"Error fetching user {username}: {e}")
            return None

    # --- Session Management DB Methods ---
    def create_session(self, token, user_id, expires_at):
        if self.mock_mode:
            user = DBManager._mock_data["users"].get(user_id)
            username = user["username"] if user else "mock_user"
            DBManager._mock_data["user_sessions"][token] = {
                "token": token,
                "user_id": user_id,
                "expires_at": expires_at,
                "username": username
            }
            return True

        self._ensure_connection()
        if not self.conn:
            return False
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO user_sessions (token, user_id, expires_at) VALUES (%s, %s, %s);",
                    (token, user_id, expires_at)
                )
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error creating session: {e}")
            self.conn.rollback()
            return False

    def get_session(self, token):
        if self.mock_mode:
            return DBManager._mock_data["user_sessions"].get(token)

        self._ensure_connection()
        if not self.conn:
            return None
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                # JOIN user data directly
                cur.execute("""
                    SELECT s.token, s.user_id, s.expires_at, u.username
                    FROM user_sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token = %s LIMIT 1;
                """, (token,))
                return cur.fetchone()
        except Exception as e:
            print(f"Error fetching session: {e}")
            return None

    def delete_session(self, token):
        if self.mock_mode:
            if token in DBManager._mock_data["user_sessions"]:
                del DBManager._mock_data["user_sessions"][token]
            return True

        self._ensure_connection()
        if not self.conn:
            return False
        try:
            with self.conn.cursor() as cur:
                cur.execute("DELETE FROM user_sessions WHERE token = %s;", (token,))
                self.conn.commit()
                return True
        except Exception as e:
            print(f"Error deleting session: {e}")
            self.conn.rollback()
            return False

    # --- Comments Management DB Methods ---
    def add_comment(self, news_id, user_id, username, comment_text):
        if self.mock_mode:
            from datetime import datetime, timezone
            if news_id not in DBManager._mock_data["news_comments"]:
                DBManager._mock_data["news_comments"][news_id] = []
            comment_id = len(DBManager._mock_data["news_comments"][news_id]) + 1
            DBManager._mock_data["news_comments"][news_id].append({
                "id": comment_id,
                "news_id": news_id,
                "user_id": user_id,
                "username": username,
                "comment_text": comment_text,
                "created_at": datetime.now(timezone.utc)
            })
            return comment_id

        self._ensure_connection()
        if not self.conn:
            return False
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO news_comments (news_id, user_id, username, comment_text) VALUES (%s, %s, %s, %s) RETURNING id;",
                    (news_id, user_id, username, comment_text)
                )
                comment_id = cur.fetchone()[0]
                self.conn.commit()
                return comment_id
        except Exception as e:
            print(f"Error inserting comment: {e}")
            self.conn.rollback()
            return False

    def get_comments(self, news_id):
        if self.mock_mode:
            # Return list of comments, filter by news_id
            return DBManager._mock_data["news_comments"].get(news_id, [])

        self._ensure_connection()
        if not self.conn:
            return []
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, news_id, user_id, username, comment_text, created_at FROM news_comments WHERE news_id = %s ORDER BY created_at ASC;",
                    (news_id,)
                )
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching comments: {e}")
            return []
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
                            location_name, latitude, longitude,
                            heading, target_location
                        ) 
                        SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
                        data.get('heading'),
                        data.get('target_location'),
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

    def get_all_news(self, include_raw=False, days=90, limit=30, offset=0, minimal=False):
        if self.mock_mode:
            events = DBManager._mock_data["news_events"]
            # Ensure sorting
            events_sorted = sorted(events, key=lambda x: x.get("created_at") or 0, reverse=True)
            sliced = events_sorted[offset:offset+limit]
            if minimal:
                # Exclude only raw_text (keep summary for map popups) in mock mode
                return [{
                    k: v for k, v in item.items() if k not in ["raw_text"]
                } for item in sliced]
            return sliced

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

        # SECURITY FIX: Use parameterized query instead of f-string interpolation
        params = []
        where_clause = ""
        if days:
            where_clause = "WHERE n.created_at >= NOW() - INTERVAL %s"
            params.append(f"{days} days")

        # Append Limit and Offset parameters safely
        params.append(int(limit))
        params.append(int(offset))

        if minimal:
            # Minimal query: loads in milliseconds, excluding heavy text blocks (raw_text) but keeps summary for UI popups
            columns = [
                "n.id", "n.channel_handle", "n.internal_id", "n.crime_type",
                "n.sub_category", "n.summary", "n.publish_date", "n.publish_time", "n.event_date",
                "n.event_time", "n.region", "n.township", "n.city", "n.location_name",
                "n.latitude", "n.longitude", "n.heading", "n.target_location", "n.created_at"
            ]
            columns_str = ", ".join(columns)
            query = f"""
                SELECT {columns_str}, COALESCE(s.display_name, n.channel_handle) as source_name
                FROM news_events n
                LEFT JOIN source_mappings s ON LOWER(n.channel_handle) = LOWER(s.handle)
                {where_clause}
                ORDER BY n.created_at DESC
                LIMIT %s OFFSET %s;
            """
        else:
            # Define all columns EXCEPT large fields like raw_text by default
            columns = [
                "n.id", "n.channel_handle", "n.internal_id", "n.summary", "n.crime_type",
                "n.sub_category", "n.publish_date", "n.publish_time", "n.event_date",
                "n.event_time", "n.region", "n.township", "n.city", "n.location_name",
                "n.latitude", "n.longitude", "n.heading", "n.target_location", "n.created_at"
            ]
            if include_raw:
                columns.append("n.raw_text")

            columns_str = ", ".join(columns)
            query = f"""
                SELECT {columns_str}, COALESCE(s.display_name, n.channel_handle) as source_name
                FROM news_events n
                LEFT JOIN source_mappings s ON LOWER(n.channel_handle) = LOWER(s.handle)
                {where_clause}
                ORDER BY n.created_at DESC
                LIMIT %s OFFSET %s;
            """

        with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchall()

    def get_aggregated_stats(self, days=90):
        # 1. Mock fallback Mode
        if self.mock_mode:
            from datetime import datetime, timedelta, timezone
            today = datetime.now(timezone.utc)
            
            category_counts = [
                {"crime_type": "စစ်ရေးသတင်း", "count": 1},
                {"crime_type": "မှုခင်းသတင်း", "count": 1},
                {"crime_type": "မတော်တဆဖြစ်မှု", "count": 0},
                {"crime_type": "သဘာဝဘေးအန္တရာယ်", "count": 0},
                {"crime_type": "အထွေထွေ", "count": 0}
            ]
            dangerous_townships = [
                {"township": "ကမာရွတ်", "city": "ရန်ကုန်", "count": 1, "score": 10},
                {"township": "လှိုင်", "city": "ရန်ကုန်", "count": 1, "score": 10}
            ]
            time_series = []
            for i in range(15):
                d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
                time_series.append({"event_date": d, "count": 1 if i in [0, 1] else 0})
            
            correlation_data = []
            for i in range(15):
                d = (today - timedelta(days=i)).strftime("%Y-%m-%d")
                correlation_data.append({
                    "date": d, 
                    "conflict_count": 1 if i == 0 else 0,
                    "refugee_count": 0
                })

            return {
                "category_counts": category_counts,
                "dangerous_townships": dangerous_townships,
                "time_series": time_series,
                "correlation_data": correlation_data
            }

        # 2. Postgres Live Mode
        self._ensure_connection()
        if not self.conn:
            return {}

        # Validate days parameter
        try:
            days = int(days)
            if days < 1: days = 1
            elif days > 365: days = 365
        except:
            days = 90

        interval_str = f"{days} days"
        
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Query A: Category counts
                cur.execute("""
                    SELECT crime_type, COUNT(*) as count 
                    FROM news_events 
                    WHERE created_at >= NOW() - INTERVAL %s AND crime_type IS NOT NULL
                    GROUP BY crime_type;
                """, (interval_str,))
                category_counts = cur.fetchall()

                # Query B: Dangerous Townships (Top 5)
                cur.execute("""
                    SELECT township, city, COUNT(*) as count, (COUNT(*) * 10) as score 
                    FROM news_events 
                    WHERE created_at >= NOW() - INTERVAL %s AND township IS NOT NULL AND township != 'မသိရ' AND township != ''
                    GROUP BY township, city 
                    ORDER BY count DESC 
                    LIMIT 5;
                """, (interval_str,))
                dangerous_townships = cur.fetchall()

                # Query C: Time series (Incident count grouped by event_date)
                cur.execute("""
                    SELECT COALESCE(event_date, publish_date)::TEXT as event_date, COUNT(*) as count 
                    FROM news_events 
                    WHERE created_at >= NOW() - INTERVAL %s AND COALESCE(event_date, publish_date) IS NOT NULL 
                    GROUP BY event_date 
                    ORDER BY event_date ASC;
                """, (interval_str,))
                time_series = cur.fetchall()

                # Query D: Correlation (Conflict vs Refugee keywords over time)
                cur.execute("""
                    SELECT COALESCE(event_date, publish_date)::TEXT as date,
                           SUM(CASE WHEN crime_type = 'စစ်ရေးသတင်း' THEN 1 ELSE 0 END) as conflict_count,
                           SUM(CASE WHEN raw_text LIKE '%%စစ်ဘေး%%' OR raw_text LIKE '%%ဒုက္ခသည်%%' THEN 1 ELSE 0 END) as refugee_count
                    FROM news_events
                    WHERE created_at >= NOW() - INTERVAL %s AND COALESCE(event_date, publish_date) IS NOT NULL
                    GROUP BY date
                    ORDER BY date ASC;
                """, (interval_str,))
                correlation_data = cur.fetchall()

                return {
                    "category_counts": category_counts,
                    "dangerous_townships": dangerous_townships,
                    "time_series": time_series,
                    "correlation_data": correlation_data
                }
        except Exception as e:
            print(f"Error querying aggregated stats: {e}")
            self.conn.rollback()
            return {}

    def get_news_by_id(self, news_id):
        if self.mock_mode:
            events = DBManager._mock_data["news_events"]
            for item in events:
                if str(item.get("id")) == str(news_id):
                    return item
            return None

        self._ensure_connection()
        if not self.conn:
            return None

        columns = [
            "n.id", "n.channel_handle", "n.internal_id", "n.summary", "n.crime_type",
            "n.sub_category", "n.publish_date", "n.publish_time", "n.event_date",
            "n.event_time", "n.region", "n.township", "n.city", "n.location_name",
            "n.latitude", "n.longitude", "n.heading", "n.target_location", "n.created_at", "n.raw_text"
        ]
        columns_str = ", ".join(columns)
        query = f"""
            SELECT {columns_str}, COALESCE(s.display_name, n.channel_handle) as source_name
            FROM news_events n
            LEFT JOIN source_mappings s ON LOWER(n.channel_handle) = LOWER(s.handle)
            WHERE n.id = %s;
        """
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (int(news_id),))
                return cur.fetchone()
        except Exception as e:
            print(f"Error fetching news by ID: {e}")
            self.conn.rollback()
            return None


    def get_recent_news_by_township(self, township, hours=24):
        if self.mock_mode:
            events = DBManager._mock_data["news_events"]
            candidates = [
                item for item in events 
                if item.get("township") == township
            ]
            return candidates

        self._ensure_connection()
        if not self.conn:
            return []

        query = """
            SELECT id, summary, raw_text, township, created_at
            FROM news_events
            WHERE township = %s AND created_at >= NOW() - INTERVAL %s;
        """
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (township, f"{hours} hours"))
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching candidates for deduplication: {e}")
            self.conn.rollback()
            return []


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


    def save_forecasts_batch(self, forecast_list):
        """Saves or updates conflict trend predictions in batch."""
        if self.mock_mode:
            forecasts = DBManager._mock_data["conflict_forecasts"]
            for item in forecast_list:
                forecasts = [
                    f for f in forecasts 
                    if not (f["township"] == item["township"] and str(f["forecast_date"]) == str(item["forecast_date"]))
                ]
                forecasts.append(item)
            DBManager._mock_data["conflict_forecasts"] = forecasts
            return len(forecast_list)

        self._ensure_connection()
        if not self.conn:
            return 0

        query = """
            INSERT INTO conflict_forecasts (township, forecast_date, predicted_count, trend)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (township, forecast_date) 
            DO UPDATE SET 
                predicted_count = EXCLUDED.predicted_count,
                trend = EXCLUDED.trend,
                created_at = NOW();
        """
        try:
            with self.conn.cursor() as cur:
                data = [
                    (item["township"], item["forecast_date"], item["predicted_count"], item["trend"])
                    for item in forecast_list
                ]
                cur.executemany(query, data)
                self.conn.commit()
                return len(forecast_list)
        except Exception as e:
            print(f"Error saving forecasts batch: {e}")
            self.conn.rollback()
            return 0

    def get_active_forecasts(self):
        """Fetches the latest forecasted trends for all townships."""
        if self.mock_mode:
            return DBManager._mock_data["conflict_forecasts"]

        self._ensure_connection()
        if not self.conn:
            return []

        query = """
            SELECT DISTINCT ON (township, forecast_date) 
                township, forecast_date, predicted_count, trend
            FROM conflict_forecasts
            WHERE forecast_date >= CURRENT_DATE
            ORDER BY township, forecast_date, created_at DESC;
        """
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query)
                return cur.fetchall()
        except Exception as e:
            print(f"Error fetching active forecasts: {e}")
            self.conn.rollback()
            return []

    def get_historical_daily_counts(self, days=90):
        """Queries daily incident counts grouped by township and event_date for time-series training."""
        if self.mock_mode:
            events = DBManager._mock_data["news_events"]
            counts = {}
            for ev in events:
                township = ev.get("township")
                date = ev.get("event_date")
                if not township or not date: continue
                key = (township, date)
                counts[key] = counts.get(key, 0) + 1
            
            return [
                {"township": k[0], "event_date": k[1], "incident_count": v}
                for k, v in counts.items()
            ]

        self._ensure_connection()
        if not self.conn:
            return []

        query = """
            SELECT township, event_date, COUNT(*) as incident_count
            FROM news_events
            WHERE event_date >= CURRENT_DATE - INTERVAL %s AND township IS NOT NULL AND township != ''
            GROUP BY township, event_date
            ORDER BY township, event_date ASC;
        """
        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, (f"{days} days",))
                return cur.fetchall()
        except Exception as e:
            print(f"Error pulling historical daily counts: {e}")
            self.conn.rollback()
            return []
