# backend/forecaster.py
from datetime import datetime, timedelta, date
from db_manager import DBManager

def run_forecast():
    """Runs conflict trend forecasting for all active townships for the next 7 days."""
    db = DBManager()
    print("🔮 Starting conflict forecasting sequence...")
    
    # 1. Fetch historical incident counts (90 days)
    raw_data = db.get_historical_daily_counts(days=90)
    if not raw_data:
        print("ℹ️ No historical incident data found. Skipping forecasting.")
        return 0

    use_pandas = False
    try:
        import pandas as pd
        use_pandas = True
    except ImportError:
        print("⚠️ Pandas not installed. Using pure python structures for rolling averages.")

    if not use_pandas:
        # PURE PYTHON FORECAST FALLBACK (No dependencies)
        township_data = {}
        for row in raw_data:
            ts = row.get("township")
            dt_str = str(row.get("event_date"))
            count = float(row.get("incident_count", 0))
            if not ts: continue
            if ts not in township_data:
                township_data[ts] = {}
            township_data[ts][dt_str] = count

        forecast_results = []
        end_date = datetime.now().date()
        future_dates = [end_date + timedelta(days=i) for i in range(1, 8)]

        for ts, dates_dict in township_data.items():
            if len(dates_dict) < 3:
                continue

            # Calculate average count of the last 7 days and previous 7 days
            last_7_sum = 0
            prev_7_sum = 0
            for i in range(7):
                d1 = (end_date - timedelta(days=i)).strftime('%Y-%m-%d')
                d2 = (end_date - timedelta(days=7+i)).strftime('%Y-%m-%d')
                last_7_sum += dates_dict.get(d1, 0.0)
                prev_7_sum += dates_dict.get(d2, 0.0)

            last_7_avg = last_7_sum / 7.0
            prev_7_avg = prev_7_sum / 7.0

            if last_7_avg > prev_7_avg + 0.05:
                trend = 'up'
            elif last_7_avg < prev_7_avg - 0.05:
                trend = 'down'
            else:
                trend = 'stable'

            # Forecast future 7 days with last 7 days average
            for f_date in future_dates:
                forecast_results.append({
                    "township": ts,
                    "forecast_date": f_date.strftime('%Y-%m-%d'),
                    "predicted_count": float(round(last_7_avg, 2)),
                    "trend": trend
                })

        if forecast_results:
            saved = db.save_forecasts_batch(forecast_results)
            print(f"✅ Pure Python Forecasting sequence complete. Saved {saved} forecast points.")
            return saved
        return 0

    # PANDAS & PROPHET FORECAST ROUTINE (Executed in production Docker environment)
    df_raw = pd.DataFrame(raw_data)
    df_raw['event_date'] = pd.to_datetime(df_raw['event_date'])
    
    townships = df_raw['township'].unique()
    forecast_results = []
    
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=90)
    full_date_range = pd.date_range(start=start_date, end=end_date)

    use_prophet = False
    try:
        from prophet import Prophet
        import logging
        logging.getLogger('prophet').setLevel(logging.ERROR)
        logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
        use_prophet = True
        print("🤖 Prophet library detected. Using Facebook Prophet model.")
    except ImportError:
        print("⚠️ Prophet library not installed. Falling back to Moving Average trend forecaster.")

    for ts in townships:
        df_ts = df_raw[df_raw['township'] == ts].copy()
        if len(df_ts) < 3:
            continue

        df_padded = pd.DataFrame({'event_date': full_date_range})
        df_padded = df_padded.merge(df_ts, on='event_date', how='left')
        df_padded['township'] = ts
        df_padded['incident_count'] = df_padded['incident_count'].fillna(0.0).astype(float)
        
        future_dates = [end_date + timedelta(days=i) for i in range(1, 8)]

        if use_prophet:
            try:
                prophet_df = df_padded[['event_date', 'incident_count']].rename(
                    columns={'event_date': 'ds', 'incident_count': 'y'}
                )
                
                m = Prophet(
                    yearly_seasonality=False, 
                    weekly_seasonality=True, 
                    daily_seasonality=False,
                    changepoint_prior_scale=0.05
                )
                m.fit(prophet_df)
                
                future = m.make_future_dataframe(periods=7, include_history=False)
                forecast = m.predict(future)
                
                predictions = forecast['yhat'].clip(lower=0.0).tolist()
                
                last_7_days_avg = df_padded.tail(7)['incident_count'].mean()
                future_avg = sum(predictions) / len(predictions)
                
                # Dynamic Threshold: At least 0.5 absolute avg increase (3.5 incidents/week) OR 25% increase
                threshold = max(0.5, last_7_days_avg * 0.25)
                
                if future_avg > last_7_days_avg + threshold:
                    trend = 'up'
                elif future_avg < last_7_days_avg - threshold:
                    trend = 'down'
                else:
                    trend = 'stable'
                    
                for idx, f_date in enumerate(future_dates):
                    forecast_results.append({
                        "township": ts,
                        "forecast_date": f_date.strftime('%Y-%m-%d'),
                        "predicted_count": float(round(predictions[idx], 2)),
                        "trend": trend
                    })
            except Exception as e:
                print(f"Prophet failed for township {ts}: {e}. Falling back to Moving Average.")
                use_prophet = False

        if not use_prophet:
            last_7_days_avg = df_padded.tail(7)['incident_count'].mean()
            prev_7_days_avg = df_padded.tail(14).head(7)['incident_count'].mean()
            
            # Dynamic Threshold for Fallback
            threshold = max(0.5, prev_7_days_avg * 0.25)
            
            if last_7_days_avg > prev_7_days_avg + threshold:
                trend = 'up'
            elif last_7_days_avg < prev_7_days_avg - threshold:
                trend = 'down'
            else:
                trend = 'stable'
                
            for f_date in future_dates:
                forecast_results.append({
                    "township": ts,
                    "forecast_date": f_date.strftime('%Y-%m-%d'),
                    "predicted_count": float(round(last_7_days_avg, 2)),
                    "trend": trend
                })

    if forecast_results:
        saved = db.save_forecasts_batch(forecast_results)
        print(f"✅ Forecasting sequence complete. Saved {saved} forecast points.")
        return saved
    return 0

if __name__ == "__main__":
    run_forecast()
