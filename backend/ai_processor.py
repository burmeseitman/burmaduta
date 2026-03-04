import os
from google import genai
import json
import requests
import re
from dotenv import load_dotenv
from db_manager import DBManager

load_dotenv()

class AIProcessor:
    _prompt_cache = None # Session-like cache for runtime

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
            # Fallback to a very safe default ONLY if it's absolutely missing in DB, 
            # but ideally it should be in system_config.
            print("⚠️ Warning: MODEL_NAME not found in Database. Defaulting to 'gemini-1.5-flash'.")
            model_name = "gemini-1.5-flash"
            
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
            response = requests.get(url, headers=headers)
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

            custom_prompt = active_prompt.replace("Message Text:", "Multiple Message Texts (delineated by MSG_ID):")
            custom_prompt = custom_prompt.replace("{{text}}", batch_text)
            custom_prompt += "\nReturn a JSON ARRAY containing objects for each MSG_ID. Each object MUST include 'internal_id' mapping back to the MSG_ID."
            custom_prompt = custom_prompt.replace("{current_date_str}", self.get_current_date())

            if not self.client:
                print("❌ Error: AI Client not initialized. Please set PROCESSOR_KEY in database.")
                return []

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=custom_prompt
            )
            
            if not response or not response.text:
                print(f"Empty AI response for batch of {len(news_items)}.")
                return []
                
            json_str = response.text.strip()
            if '```json' in json_str:
                json_str = json_str.split('```json')[1].split('```')[0].strip()
            
            if not json_str or json_str.lower() == 'null':
                return []
            
            results = json.loads(json_str)
            if isinstance(results, dict): # Sometimes AI returns a single object even if requested array
                results = [results]
                
            final_data = []
            for data in results:
                # 🛑 SAFETY: Check if data is a valid dictionary before calling .get()
                if not data or not isinstance(data, dict):
                    continue
                
                # � DATA CLEANING: Convert string versions of nulls into actual None
                # This fixes "invalid input syntax for type time: 'null'" errors
                for key, value in data.items():
                    if isinstance(value, str):
                        low_val = value.strip().lower()
                        if low_val in ['null', 'none', 'n/a', '', 'undefined']:
                            data[key] = None
                        else:
                            # Keep it string but trim it
                            data[key] = value.strip()

                # �🧹 Clean & Normalize Sub-category
                sub_cat = data.get('sub_category')
                if sub_cat and isinstance(sub_cat, str):
                    # Remove brackets and replace English comma with Burmese punctuation
                    sub_cat = sub_cat.replace('{', '').replace('}', '').replace(',', '၊').strip()
                    data['sub_category'] = sub_cat

                # 🛑 TIME VALIDATION: Ensure event_time is valid for Postgres TIME type
                event_time = data.get('event_time')
                if event_time and isinstance(event_time, str):
                    # Check if it matches HH:mm:ss or HH:mm pattern
                    if not re.match(r'^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$', event_time):
                        data['event_time'] = None

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
