import os
import json
import requests
import re
import hashlib
import time
from google import genai
from dotenv import load_dotenv
from db_manager import DBManager

load_dotenv()

class AIProcessor:
    _prompt_cache = None # Session-like cache for prompt text
    _current_cache_name = None
    _current_cache_hash = None
    _cache_expire_time = 0


    def __init__(self, db=None):
        self.db = db if db else DBManager()
        
        # Strictly retrieve AI config from Database
        api_key = self.db.get_config("PROCESSOR_KEY")
        if not api_key:
            print("❌ Error: PROCESSOR_KEY not found in Database configuration (system_config table).")
            # We don't raise here to allow the object to exist, 
            # but calls to generate_content will fail.
        
        self.client = genai.Client(api_key=api_key) if api_key else None

        # Strictly retrieve Model Name from database
        model_name = self.db.get_config("MODEL_NAME")
        if not model_name:
            # Fallback to a safe default ONLY if it's absolutely missing in DB
            print("⚠️ Warning: MODEL_NAME not found in Database. Defaulting to High-performance model.")
            model_name = "gemini-2.5-flash-lite"
            
        self.model_name = model_name
        
        # Initialize or retrieve prompt
        self.get_active_prompt()

    def get_active_prompt(self):
        """Retrieve prompt from DB and cache it for the session."""
        if AIProcessor._prompt_cache:
            return AIProcessor._prompt_cache
            
        # Try fetching from DB
        db_prompt = self.db.get_config("AI_PROMPT")
        
        if not db_prompt:
            # Fallback (optional: if you want a default if DB is empty)
            # Should ideally be populated via migration
            print("⚠️ Warning: AI_PROMPT not found in DB configuration.")
            return ""
            
        AIProcessor._prompt_cache = db_prompt
        return db_prompt

    def get_current_date(self):
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d")
    def geocode(self, location_name):
        """Backup geocoding using Nominatim (OpenStreetMap)"""
        try:
            url = f"https://nominatim.openstreetmap.org/search?q={location_name},+Myanmar&format=json&limit=1"
            headers = {'User-Agent': 'BurmaDutaApp/1.0'}
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200 and len(response.json()) > 0:
                data = response.json()[0]
                return float(data['lat']), float(data['lon'])
        except Exception as e:
            print(f"Error geocoding: {e}")
        return None, None

    def parse_news_batch(self, news_items):
        """
        Parses multiple news snippets in a single AI call.
        news_items: List of dicts with {'id': msg_id, 'text': text}
        """
        if not news_items:
            return []

        try:
            # Prepare the batch text
            batch_text = ""
            for item in news_items:
                batch_text += f"--- MSG_ID: {item['id']} ---\n{item['text']}\n\n"

            active_prompt = self.get_active_prompt()
            if not active_prompt:
                print("❌ Error: No AI_PROMPT available.")
                return []

            # 🛠️ CONTEXT CACHING REFACTOR: 
            # Separate static instructions from dynamic message content
            instructions_base = active_prompt.replace("Message Text:", "Multiple Message Texts (delineated by MSG_ID):")
            instructions_base = instructions_base.replace("{{text}}", "\n[NEWS DATA LISTED BELOW]\n")
            instructions_base += "\nReturn a JSON ARRAY containing objects for each MSG_ID. Each object MUST include 'internal_id' mapping back to the MSG_ID."
            instructions_base = instructions_base.replace("{current_date_str}", self.get_current_date())
            
            if not self.client:
                print("❌ Error: AI Client not initialized. Please set PROCESSOR_KEY in database.")
                return []

            # Add safety settings
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
            ]

            # Try to use/create context cache
            cache_name = self._get_context_cache(instructions_base)
            
            max_retries = 3
            retry_count = 0
            response = None
            
            while retry_count < max_retries:
                try:
                    if cache_name:
                        response = self.client.models.generate_content(
                            model=self.model_name,
                            contents=batch_text,
                            config={
                                'cached_content': cache_name,
                                'safety_settings': safety_settings,
                                'response_mime_type': 'application/json'
                            }
                        )
                    else:
                        # Fallback to standard request
                        full_prompt = instructions_base + "\n\n" + batch_text
                        response = self.client.models.generate_content(
                            model=self.model_name,
                            contents=full_prompt,
                            config={
                                'safety_settings': safety_settings,
                                'response_mime_type': 'application/json'
                            }
                        )
                    # If success, break the retry loop
                    if response:
                        break
                except Exception as e:
                    msg = str(e).lower()
                    if ("503" in msg or "unavailable" in msg or "deadline" in msg) and retry_count < max_retries - 1:
                        retry_count += 1
                        wait_time = (2 ** retry_count) + (0.5 * retry_count)
                        print(f"⚠️ AI API Transient Error ({msg[:50]}). Retrying in {wait_time:.1f}s ({retry_count}/{max_retries})...")
                        time.sleep(wait_time)
                    else:
                        print(f"❌ AI Generation Error: {e}")
                        return []
            
            if not response or not response.text:
                # Check for safety blocks
                if response and hasattr(response, 'candidates') and response.candidates:
                    can = response.candidates[0]
                    if hasattr(can, 'finish_reason'):
                        if can.finish_reason == 'SAFETY':
                            print(f"⚠️ AI response BLOCKED by safety filters for batch of {len(news_items)}.")
                        else:
                            print(f"Empty AI response (Reason: {can.finish_reason}) for batch of {len(news_items)}.")
                else:
                    print(f"Empty AI response for batch of {len(news_items)}.")
                return []
                
            json_str = response.text.strip()
            # Clean up potential markdown marks
            if '```json' in json_str:
                json_str = json_str.split('```json')[1].split('```')[0].strip()
            elif '```' in json_str:
                json_str = json_str.split('```')[1].split('```')[0].strip()
            
            if not json_str or json_str.lower() == 'null' or json_str == '[]':
                print(f"ℹ️ AI returned empty/null results for {len(news_items)} items (likely didn't match categories).")
                return []
            
            # 🛡️ TRUNCATION FIX: If the AI output was truncated, find the last valid JSON array closure
            if not json_str.endswith(']'):
                last_bracket = json_str.rfind('}')
                if last_bracket != -1:
                    # Closing the JSON array properly
                    json_str = json_str[:last_bracket+1] + ']'
                else:
                    last_list_bracket = json_str.rfind(']')
                    if last_list_bracket != -1:
                        json_str = json_str[:last_list_bracket+1]
            
            try:
                results = json.loads(json_str)
            except Exception as e:
                # One last attempt to fix common delimiter errors
                try:
                    # Sometimes AI forgets commas between objects if it's rushed/truncated
                    fixed_str = json_str.replace('}{', '},{')
                    results = json.loads(fixed_str)
                except:
                    print(f"❌ AI JSON Parse Error: {e}. Raw: {json_str[:200]}...")
                    return []

            if isinstance(results, dict): 
                results = [results]
                
            final_data = []
            for data in results:
                # 🛑 SAFETY: Check if data is a valid dictionary before calling .get()
                if not data or not isinstance(data, dict):
                    continue
                
                # 🧽 COMPREHENSIVE DATA CLEANING
                for key, value in data.items():
                    if value is None:
                        continue
                    
                    # 1. Handle Lists (convert to string with Burmese punctuation)
                    if isinstance(value, list):
                        value = "၊".join([str(v).strip() for v in value if v])
                    
                    if isinstance(value, str):
                        # 2. Convert string-nulls to actual None
                        low_val = value.strip().lower()
                        if low_val in ['null', 'none', 'n/a', '', 'undefined', 'မသိရ', 'မသိရှိရ', 'မသိရှိပါ။']:
                            data[key] = None
                            continue
                        
                        # 3. Clean string values (trim, remove brackets, fix commas)
                        cleaned = value.replace('{', '').replace('}', '').replace('[', '').replace(']', '').replace(',', '၊').strip()
                        data[key] = cleaned
                    else:
                        # Ensure numeric/other types are preserved or passed as is
                        data[key] = value

                # 🛑 TIME VALIDATION: Ensure event_time is valid for Postgres TIME type
                event_time = data.get('event_time')
                event_date = data.get('event_date')
                
                # Check event_date
                if event_date and isinstance(event_date, str):
                    if not re.match(r'^\d{4}-\d{2}-\d{2}$', event_date):
                         data['event_date'] = None

                if event_time and isinstance(event_time, str):
                    # Check if it matches HH:mm:ss or HH:mm pattern
                    if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$', event_time):
                        data['event_time'] = None

                # 🛑 LOCATION GUARD: Only accept results within Myanmar
                # Discard news from foreign locations (like Bangkok, Thailand, etc.)
                region = str(data.get('region') or '').lower()
                township = str(data.get('township') or '').lower()
                city = str(data.get('city') or '').lower()
                location_name = str(data.get('location_name') or '').lower()
                
                FOREIGN_KEYWORDS = [
                    'bangkok', 'thailand', 'ဘန်ကောက်', 'ထိုင်း', 'မလေးရှား', 'malaysia',
                    'india', 'china', 'laos', 'cambodia', 'vietnam', 'bangladesh',
                    'တရုတ်', 'အိန္ဒိယ', 'ဘင်္ဂလားဒေ့ရှ်'
                ]
                
                location_full = f"{region} {township} {city} {location_name}"
                if any(kw in location_full for kw in FOREIGN_KEYWORDS):
                    # print(f"Skipping non-Myanmar news item: {location_full}")
                    continue

                # If AI missed lat/lon, try Nominatim
                if not data.get('latitude') or not data.get('longitude'):
                    if data.get('location_name'):
                        lat, lon = self.geocode(data['location_name'])
                        data['latitude'] = lat
                        data['longitude'] = lon
                final_data.append(data)
            
            return final_data
        except Exception as e:
            print(f"Error parsing AI batch response: {e}")
            return []

    def parse_news(self, text):
        """Single item wrapper."""
        res = self.parse_news_batch([{'id': 0, 'text': text}])
        return res[0] if res else None

    def _get_context_cache(self, instructions):
        """Creates or retrieves a context cache for the given instructions."""
        # Hash instructions to detect prompt changes
        instr_hash = hashlib.md5(instructions.encode()).hexdigest()
        
        # 1. Check if we have a valid, recent cache
        # We use class variables to share cache across calls in the same session
        if (AIProcessor._current_cache_name and 
            AIProcessor._current_cache_hash == instr_hash and 
            time.time() < AIProcessor._cache_expire_time):
            return AIProcessor._current_cache_name

        try:
            # Note: Context caching requires a minimum of 32,768 tokens in many tiers.
            # However, we attempt to create it; if it's too small, it will return an error 
            # which we catch to fallback to regular calls.
            print(f"🔄 Creating Context Cache for {self.model_name}...")
            
            cache = self.client.caches.create(
                model=self.model_name,
                config={
                    'display_name': f'burmaduta_instructions_{instr_hash[:8]}',
                    'contents': [{'role': 'user', 'parts': [{'text': instructions}]}],
                    'ttl': '3600s', # 1 hour TTL (standard)
                }
            )
            
            AIProcessor._current_cache_name = cache.name
            AIProcessor._current_cache_hash = instr_hash
            # Local expiration set to 55 minutes to be safe
            AIProcessor._cache_expire_time = time.time() + 3300 
            
            print(f"✅ Context Cache created: {cache.name} (Saves input tokens for future batches)")
            return cache.name
            
        except Exception as e:
            # Silent fallback for common "too short" or non-supported scenarios
            msg = str(e).lower()
            if "minimum" in msg or "too short" in msg or "invalid" in msg:
                # Log only once to avoid cluttering logs
                if AIProcessor._current_cache_hash != "SKIPPED":
                    print(f"ℹ️ Context caching skipped: Instructions likely too small (< 32k tokens) or model limit. Normal billing applies.")
                    AIProcessor._current_cache_hash = "SKIPPED"
            else:
                # Group 503 (Unavailable) and other transient API issues as 'skipped' to avoid log noise
                if "503" in msg or "unavailable" in msg or "deadline" in msg:
                    if AIProcessor._current_cache_hash != "SKIPPED_API":
                        print(f"ℹ️ Context caching skipped: Google API busy or unavailable. Falling back to standard calls.")
                        AIProcessor._current_cache_hash = "SKIPPED_API"
                else:
                    print(f"⚠️ Context Cache Creation Error: {e}")
            
            AIProcessor._current_cache_name = None
            return None
