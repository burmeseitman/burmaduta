import os
from google import genai
import json
import requests
from dotenv import load_dotenv
from db_manager import DBManager

load_dotenv()

PROMPT_TEMPLATE = """
You are an expert news analyst specialized strictly in Myanmar events.
Current date for context: {current_date_str}

ONLY extract details if the news describes an incident occurring INSIDE MYANMAR (Burma).
If the news is about events outside Myanmar, return the JSON value null (literal null, not an object).
Extract the following details from the news text and return as a VALID JSON OBJECT.
If a field is missing, set it to null.
The location must include latitude and longitude using Nominatim-compatible names if possible.

Required fields:
- event_date: The date when the INCIDENT HAPPENED (extract from text if mentioned, else choose most plausible date based on context). Format: YYYY-MM-DD.
- event_time: The time when the INCIDENT HAPPENED (extract from text if mentioned, else null). HH:MM format.
- region: Name of Region or State in BURMESE (e.g., ရန်ကုန်၊ စစ်ကိုင်း၊ ရှမ်း)
- township: Name of Township in BURMESE (e.g., လှိုင်၊ ကလေး)
- city: Name of City in BURMESE if applicable
- location_name: specific place name in BURMESE (Include Township or City)
- latitude: decimal float
- longitude: decimal float
- crime_type: categorize as one of [စစ်ရေးသတင်း, မှုခင်းသတင်း, မတော်တဆဖြစ်မှု, သဘာဝဘေးအန္တရာယ်, အထွေထွေနှင့် ဝန်ဆောင်မှု]
- sub_category: Select the most specific sub-category based on the crime_type:
    - If crime_type is 'စစ်ရေးသတင်း': [တိုက်ပွဲဖြစ်ပွားမှု, လက်နက်ကြီး/လေကြောင်းရန်, စစ်ဘေးရှောင်သတင်း]
    - If crime_type is 'မှုခင်းသတင်း': [လုယက်, ဓားပြတိုက်, ဖောက်ထွင်း, လူသတ်, မူးယစ်ဆေး]
    - If crime_type is 'မတော်တဆဖြစ်မှု': [ကားတိုက်, ဆိုင်ကယ်မှောက်, မီးလောင်, ရေနစ်]
    - If crime_type is 'သဘာဝဘေးအန္တရာယ်': [ရေကြီး, မုန်တိုင်း, ငလျင်, မြေပြို]
    - Otherwise: null
- summary: short 1-sentence summary in English (do NOT include data source info)

Message Text:
{{text}}

JSON Output:
"""

class AIProcessor:
    def __init__(self, db=None):
        self.db = db if db else DBManager()
        api_key = self.db.get_config("PROCESSOR_KEY", os.getenv("PROCESSOR_KEY"))
        self.client = genai.Client(api_key=api_key)
        self.model_name = self.db.get_config("MODEL_NAME", "smart-analyze-v1")

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

    def parse_news(self, text):
        try:
            prompt = PROMPT_TEMPLATE.replace("{text}", text).replace("{current_date_str}", self.get_current_date())
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            
            if not response or not response.text:
                print(f"Empty AI response for: {text[:50]}...")
                return None
                
            json_str = response.text.strip()
            if '```json' in json_str:
                json_str = json_str.split('```json')[1].split('```')[0].strip()
            
            if not json_str or json_str.lower() == 'null':
                print("Ignored: Not a Myanmar event.")
                return None
            
            data = json.loads(json_str)
            
            # If AI missed lat/lon, try Nominatim
            if not data.get('latitude') or not data.get('longitude'):
                if data.get('location_name'):
                    lat, lon = self.geocode(data['location_name'])
                    data['latitude'] = lat
                    data['longitude'] = lon
            
            return data
        except Exception as e:
            print(f"Error parsing AI response: {e}")
            return None
