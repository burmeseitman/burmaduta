# backend/test_forecaster.py
from db_manager import DBManager
from forecaster import run_forecast
from datetime import datetime, timedelta, date

def test_forecaster():
    print("🧪 Starting Forecast Model Unit Tests...")
    
    db = DBManager()
    # Ensure mock mode contains enough news events to forecast a trend
    if db.mock_mode:
        print("ℹ️ Mock mode detected. Adding 10 days of historical events for 'ကမာရွတ်' township...")
        events = DBManager._mock_data["news_events"]
        base_date = datetime.now() - timedelta(days=15)
        for i in range(15):
            event_date = (base_date + timedelta(days=i)).strftime('%Y-%m-%d')
            events.append({
                "id": 100 + i,
                "channel_handle": "@burma_duta_mock",
                "internal_id": 2000 + i,
                "summary": f"စမ်းသပ်မှု ဖြစ်စဉ် သတင်း #{i} - ကမာရွတ်မြို့နယ်တွင် ပစ်ခတ်မှု ဖြစ်ပွားခဲ့သည်။",
                "crime_type": "စစ်ရေးသတင်း",
                "publish_date": event_date,
                "event_date": event_date,
                "township": "ကမာရွတ်",
                "region": "ရန်ကုန်",
                "latitude": 16.82,
                "longitude": 96.13,
                "created_at": None
            })
        DBManager._mock_data["news_events"] = events

    # Run the forecast pipeline
    saved_count = run_forecast()
    print(f"Predictions generated: {saved_count}")
    
    # Retrieve forecasts
    forecasts = db.get_active_forecasts()
    assert len(forecasts) > 0, "No active predictions found in DB forecasts table"
    
    print("\nSample forecasts retrieved:")
    for f in forecasts[:3]:
        print(f"📍 Township: {f['township']} | Date: {f['forecast_date']} | Predict Count: {f['predicted_count']} | Trend: {f['trend']}")
        
    print("\n🎉 Conflict Trend Predictor unit tests completed successfully!")

if __name__ == "__main__":
    test_forecaster()
