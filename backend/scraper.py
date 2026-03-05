from telethon import TelegramClient, events
import os
import asyncio
import re
import random
from dotenv import load_dotenv
from db_manager import DBManager
from ai_processor import AIProcessor

load_dotenv()

db = DBManager()

# Global placeholders - will be initialized in main()
client = None
ai = AIProcessor()
ai_lock = asyncio.Lock()

# 🛡️ STEALTH: Simple cache to avoid redundant get_entity() calls
ENTITY_CACHE = {}

async def process_messages_batch(messages_batch):
    """
    Processes a batch of raw message objects.
    1. Extracts metadata.
    2. Filters out existing records using DB check.
    3. Sends batch text to AI.
    4. Saves results in a single DB transaction.
    """
    if not messages_batch:
        return

    # 1. Prepare items for processing and check existence
    to_process = []
    
    for msg_obj in messages_batch:
        message_text = getattr(msg_obj, 'message', '')
        message_id = getattr(msg_obj, 'id', 0)
        
        if not message_text or not isinstance(message_text, str):
            continue
            
        # 🧼 CLEANING: Remove emojis while preserving Burmese and English text
        # Using a regex that targets symbols/pictographs
        clean_text = re.sub(r'[\U00010000-\U0010ffff]', '', message_text)
        # Also trim extra whitespace that might be left behind
        message_text = " ".join(clean_text.split())

        # Get channel handle (Cached for Stealth)
        try:
            peer = getattr(msg_obj, 'peer_id', None)
            peer_id = str(getattr(peer, 'channel_id', peer))
            
            if peer_id in ENTITY_CACHE:
                channel_handle = ENTITY_CACHE[peer_id]
            else:
                chat = await client.get_entity(peer) if peer else None
                if chat:
                    channel_handle = getattr(chat, 'username', str(getattr(chat, 'id', 'unknown')))
                    ENTITY_CACHE[peer_id] = channel_handle # Cache it
                else:
                    channel_handle = "unknown"
                
            if channel_handle and not channel_handle.startswith('@') and not channel_handle.isdigit() and channel_handle != "unknown":
                channel_handle = f"@{channel_handle}"
        except Exception as e:
            # print(f"DEBUG: Entity fetch error for msg {message_id}: {e}")
            channel_handle = "unknown"

        # DE-DUPE CHECK: Skip if already in DB
        if db.check_exists(channel_handle, message_id):
            print(f"Skipping {channel_handle} ({message_id}): Already processed.")
            continue

        to_process.append({
            'msg_obj': msg_obj,
            'id': message_id,
            'text': message_text,
            'channel_handle': channel_handle
        })

    if not to_process:
        return

    # 2. Process with AI in BATCH
    async with ai_lock:
        print(f"🤖 Calling AI BATCH for {len(to_process)} messages...")
        # Prepare inputs for parse_news_batch
        ai_inputs = [{'id': item['id'], 'text': item['text']} for item in to_process]
        batch_results = ai.parse_news_batch(ai_inputs)
        
        # 3. Match AI results back to metadata and build insert list
        save_list = []
        if not batch_results:
             # This is often normal if the AI filtered out all messages based on the prompt rules
             return

        for parsed_data in batch_results:
            # Match by internal_id mapping back to original
            ext_id = parsed_data.get('internal_id')
            if ext_id is None: continue
            
            # Use original ID as key (numeric match)
            orig = next((x for x in to_process if str(x['id']) == str(ext_id)), None)
            if not orig:
                continue
                
            msg_obj = orig['msg_obj']
            publish_dt = msg_obj.date
            
            save_list.append({
                'channel_handle': orig['channel_handle'],
                'internal_id': orig['id'],
                'raw_text': orig['text'],
                'summary': parsed_data.get('summary'),
                'crime_type': parsed_data.get('crime_type'),
                'publish_date': publish_dt.strftime('%Y-%m-%d'),
                'publish_time': publish_dt.strftime('%H:%M'),
                'event_date': parsed_data.get('event_date'),
                'event_time': parsed_data.get('event_time'),
                'region': parsed_data.get('region'),
                'township': parsed_data.get('township'),
                'city': parsed_data.get('city'),
                'location_name': parsed_data.get('location_name'),
                'latitude': parsed_data.get('latitude'),
                'longitude': parsed_data.get('longitude'),
                'sub_category': parsed_data.get('sub_category')
            })

        # 4. Save to database in BATCH
        if save_list:
            inserted = db.insert_news_batch(save_list)
            if inserted > 0:
                print(f"✅ Batch complete. Saved {inserted}/{len(to_process)} new records.")
            else:
                print(f"ℹ️ All {len(to_process)} items in this batch were duplicates (semantic or ID). Skip.")
        
        # Throttling to respect AI limits (adjust as needed for batch size)
        await asyncio.sleep(5)

@events.register(events.NewMessage())
async def handle_new_message(event):
    if not client: return 
    try:
        # Check if the message is from our monitored channels
        chat = await event.get_chat()
        channel_handle = getattr(chat, 'username', str(getattr(chat, 'id', 'unknown')))
        if channel_handle and not channel_handle.startswith('@') and not channel_handle.isdigit():
             channel_handle = f"@{channel_handle}"
        
        # Pull latest channels list from DB
        CHANNELS_STR = db.get_config("INPUT_CHANNELS", "")
        CHANNELS = [c.strip() for c in CHANNELS_STR.split(",")]
        
        if channel_handle not in CHANNELS:
            return
            
        # 🕵️ STEALTH JITTER: Add a random delay (1-4 seconds)
        await asyncio.sleep(random.uniform(1.2, 3.8))

        # Live updates: process immediately
        msg_obj = event.message if hasattr(event, 'message') else event
        if not msg_obj or not hasattr(msg_obj, 'date'):
             return
             
        # Optional: Pre-extract channel handle from the event for efficiency
        chat = await event.get_chat()
        channel_handle = getattr(chat, 'username', str(getattr(chat, 'id', 'unknown')))
        if channel_handle and not channel_handle.startswith('@') and not channel_handle.isdigit():
             channel_handle = f"@{channel_handle}"
             
        await process_messages_batch([msg_obj])
    except Exception as e:
        print(f"❌ Error in handle_new_message: {e}")
        import traceback
        traceback.print_exc()

async def backfill_channel(channel):
    try:
        entity = await client.get_entity(channel)
        print(f"➜ Backfill Initialized: {channel}")
        
        limit = int(db.get_config("FETCH_LIMIT", 50))
        batch_size = 10
        current_batch = []
        
        async for message in client.iter_messages(entity, limit=limit):
            current_batch.append(message)
            if len(current_batch) >= batch_size:
                await process_messages_batch(current_batch)
                current_batch = []
        
        # Process remaining
        if current_batch:
            await process_messages_batch(current_batch)
            
    except Exception as e:
        print(f"Error backfilling {channel}: {e}")

async def main():
    global client
    
    # 1. Fetch Credentials STRICTLY from Supabase
    print("🔄 Fetching Telegram credentials from Supabase...")
    API_ID_STR = db.get_config("API_ID")
    API_HASH = db.get_config("API_HASH")
    CHANNELS_STR = db.get_config("INPUT_CHANNELS", "@newsfeed")
    CHANNELS = [c.strip() for c in CHANNELS_STR.split(",")]
    
    if not API_ID_STR or not API_HASH:
        print("❌ Error: API_ID or API_HASH not found in Supabase (system_config table).")
        print("Please add them to the database first.")
        return

    try:
        API_ID = int(API_ID_STR)
    except ValueError:
        print(f"❌ Error: Invalid API_ID format in DB: {API_ID_STR}")
        return

    # 2. Initialize Client with DB Credentials (Inside a sub-directory for Docker stability)
    os.makedirs('sessions', exist_ok=True)
    client = TelegramClient('sessions/burmaduta', API_ID, API_HASH)
    
    # Register events manually since we initialized late
    client.add_event_handler(handle_new_message)

    # 🕵️ STEALTH: Start and then ensure we are not showing as 'online'
    await client.start()
    from telethon import functions
    await client(functions.account.UpdateStatusRequest(offline=True))
    print(f"🕵️ Stealth Scraper started using AppID: {API_ID} (Presence hidden).")
    
    # Run backfill tasks for all channels in parallel
    backfill_tasks = [asyncio.create_task(backfill_channel(ch)) for ch in CHANNELS]
    
    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())
