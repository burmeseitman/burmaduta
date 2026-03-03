import os
import google.generativeai as genai
import json
import requests
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-flash-lite-latest")

PROMPT_TEMPLATE = """
You are an expert news analyst for Myanmar.
Extract the following details from the news text and return as a VALID JSON OBJECT.
If something is missing, set it to null.
The location must include latitude and longitude using Nominatim-compatible names if possible.

Required fields:
- event_date: The date when the INCIDENT HAPPENED (extract from text if mentioned, else null). YYYY-MM-DD format.
- event_time: The time when the INCIDENT HAPPENED (extract from text if mentioned, else null). HH:MM format.
- location_name: specific place name (Include Township or City)
- latitude: decimal float
- longitude: decimal float
- crime_type: categorize as one of [တိုက်ပွဲသတင်း, မှုခင်းသတင်း, မတော်တဆဖြစ်မှု, သဘာဝဘေးအန္တရာယ်, အထွေထွေနှင့် ဝန်ဆောင်မှု]
  - တိုက်ပွဲသတင်း: (Conflict/Military) such as တိုက်ပွဲ၊ လေကြောင်း၊ လက်နက်ကြီး၊ စစ်ကြောင်း၊ PDF/စစ်ကောင်စီ
  - မှုခင်းသတင်း: (Crime News) such as လုယက်၊ ဓားပြတိုက်၊ ဖောက်ထွင်း၊ လူသတ်၊ မူးယစ်ဆေး
  - မတော်တဆဖြစ်မှု: (Accidents) such as ကားတိုက်၊ ဆိုင်ကယ်မှောက်၊ မီးလောင်၊ ရေနစ်
  - သဘာဝဘေးအန္တရာယ်: (Natural Disasters) such as ရေကြီး၊ မုန်တိုင်း၊ ငလျင်၊ မြေပြို
  - အထွေထွေနှင့် ဝန်ဆောင်မှု: (General and Services) as လမ်းပိတ်ဆို့၊ ယာဉ်ကြောပိတ်ဆို့၊ ကျမ္မာရေး၊ အသိပေးကြေငြာ၊ ပွဲလမ်းသဘင်
- summary: short 1-sentence summary in English

Message Text:
{text}

JSON Output:
"""

class AIProcessor:
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
            response = model.generate_content(PROMPT_TEMPLATE.format(text=text))
            json_str = response.text.strip()
            if '```json' in json_str:
                json_str = json_str.split('```json')[1].split('```')[0].strip()
            
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
