from telethon import TelegramClient, events
import os
import asyncio
from dotenv import load_dotenv
from db_manager import DBManager
from ai_processor import AIProcessor

load_dotenv()

API_ID = int(os.getenv("TELEGRAM_API_ID"))
API_HASH = os.getenv("TELEGRAM_API_HASH")
CHANNELS = [c.strip() for c in os.getenv("TELEGRAM_CHANNELS", "@khitthitnews").split(",")]

client = TelegramClient('burmaduta_session', API_ID, API_HASH)
db = DBManager()
ai = AIProcessor()

@client.on(events.NewMessage(chats=CHANNELS))
async def handle_new_message(event):
    message = getattr(event, 'message', event)
    message_text = getattr(message, 'message', '')
    message_id = getattr(message, 'id', 0)
    
    # Get publish date/time from Telegram
    publish_dt = message.date
    publish_date = publish_dt.strftime('%Y-%m-%d')
    publish_time = publish_dt.strftime('%H:%M')
    
    # Get channel handle
    chat = await event.get_chat()
    channel_handle = getattr(chat, 'username', str(getattr(chat, 'id', 'unknown')))
    if channel_handle and not channel_handle.startswith('@'):
        channel_handle = f"@{channel_handle}"

    if not message_text:
        return
    
    print(f"New message from {channel_handle} ({message_id}): {message_text[:100]}...")
    
    # Process with AI
    parsed_data = ai.parse_news(message_text)
    
    if parsed_data:
        # Save to database with separate times
        db.insert_news({
            'channel_handle': channel_handle,
            'telegram_id': message_id,
            'raw_text': message_text,
            'summary': parsed_data.get('summary'),
            'crime_type': parsed_data.get('crime_type'),
            'publish_date': publish_date,
            'publish_time': publish_time,
            'event_date': parsed_data.get('event_date'),
            'event_time': parsed_data.get('event_time'),
            'location_name': parsed_data.get('location_name'),
            'latitude': parsed_data.get('latitude'),
            'longitude': parsed_data.get('longitude')
        })
        print(f"Saved: {parsed_data.get('location_name')} ({parsed_data.get('crime_type')}) | Event: {parsed_data.get('event_date')} {parsed_data.get('event_time')}")

async def main():
    await client.start()
    print(f"Listening for news from channels: {', '.join(CHANNELS)}...")
    
    # Connection check and backfill for each channel
    for channel in CHANNELS:
        try:
            entity = await client.get_entity(channel)
            print(f"Connected to: {entity.title} ({channel})")
            
            # Limited backfill
            print(f"Backfilling {channel}...")
            async for message in client.iter_messages(entity, limit=5):
                if message.message:
                    # Provide dummy event for backfill context if needed, 
                    # but handle_new_message expects an event or message
                    await handle_new_message(message)
        except Exception as e:
            print(f"Error accessing {channel}: {e}")

    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
