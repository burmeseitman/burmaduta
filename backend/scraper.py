from telethon import TelegramClient, events
import os
import asyncio
from dotenv import load_dotenv
from db_manager import DBManager
from ai_processor import AIProcessor

load_dotenv()

db = DBManager()

# Load configuration from Database
API_ID = int(db.get_config("API_ID", os.getenv("SOURCE_API_ID")))
API_HASH = db.get_config("API_HASH", os.getenv("SOURCE_API_HASH"))
CHANNELS_STR = db.get_config("INPUT_CHANNELS", os.getenv("SOURCE_CHANNELS", "@newsfeed"))
CHANNELS = [c.strip() for c in CHANNELS_STR.split(",")]

client = TelegramClient('burmaduta_session', API_ID, API_HASH)
ai = AIProcessor()
ai_lock = asyncio.Lock()

@client.on(events.NewMessage(chats=CHANNELS))
async def handle_new_message(event):
    # event can be a NewMessage event or a raw Message object (from backfill)
    if hasattr(event, 'message') and not isinstance(event.message, str):
        msg_obj = event.message
    else:
        msg_obj = event
    
    # Ensure we are dealing with a Message object that has .date
    if not hasattr(msg_obj, 'date'):
        return

    message_text = getattr(msg_obj, 'message', '')
    message_id = getattr(msg_obj, 'id', 0)
    
    if not message_text or not isinstance(message_text, str):
        return
    
    # Get publish date/time from Source
    publish_dt = msg_obj.date
    publish_date = publish_dt.strftime('%Y-%m-%d')
    publish_time = publish_dt.strftime('%H:%M')
    
    # Get channel handle
    try:
        chat = await event.get_chat() if hasattr(event, 'get_chat') else await client.get_entity(msg_obj.peer_id)
        channel_handle = getattr(chat, 'username', str(getattr(chat, 'id', 'unknown')))
        if channel_handle and not channel_handle.startswith('@'):
            channel_handle = f"@{channel_handle}"
    except:
        channel_handle = "unknown"

    if not message_text:
        return
    
    # Check if we already processed this message ID to save AI quota
    if db.check_exists(channel_handle, message_id):
        print(f"Skipping {channel_handle} ({message_id}): Already processed.")
        return

    # Process with AI (Using a lock to respect global rate limits)
    async with ai_lock:
        print(f"🤖 Calling AI for {channel_handle} ({message_id})...")
        parsed_data = ai.parse_news(message_text)
        
        if parsed_data:
            # Save to database
            db.insert_news({
                'channel_handle': channel_handle,
                'internal_id': message_id,
                'raw_text': message_text,
                'summary': parsed_data.get('summary'),
                'crime_type': parsed_data.get('crime_type'),
                'publish_date': publish_date,
                'publish_time': publish_time,
                'event_date': parsed_data.get('event_date'),
                'event_time': parsed_data.get('event_time'),
                'region': parsed_data.get('region'),
                'township': parsed_data.get('township'),
                'city': parsed_data.get('city'),
                'location_name': parsed_data.get('location_name'),
                'latitude': parsed_data.get('latitude'),
                'longitude': parsed_data.get('longitude')
            })
            print(f"✅ Saved: {parsed_data.get('location_name')} ({parsed_data.get('crime_type')})")
            # Always throttle after a successful or unsuccessful AI call 
            # (as long as we actually sent the request)
            await asyncio.sleep(6) 

async def backfill_channel(channel):
    try:
        entity = await client.get_entity(channel)
        print(f"➜ Backfill Initialized: {channel}")
        
        limit = int(db.get_config("FETCH_LIMIT", 50))
        async for message in client.iter_messages(entity, limit=limit):
            await handle_new_message(message)
    except Exception as e:
        print(f"Error backfilling {channel}: {e}")

async def main():
    await client.start()
    print(f"📡 System LIVE. Monitoring: {', '.join(CHANNELS)}")
    
    # Run backfill tasks for all channels in parallel
    backfill_tasks = [asyncio.create_task(backfill_channel(ch)) for ch in CHANNELS]
    
    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
