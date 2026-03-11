import asyncio
import sys
import os

# Add backend directory to sys.path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ai_service import AIService

async def test_ai():
    print("🤖 Initializing AI Service...")
    ai = AIService()
    
    print(f"📡 Connecting to: {ai.client.base_url}")
    print(f"🧠 Model: {ai.model}")
    
    description = "A simple todo list with users and tasks"
    print(f"\n📝 Sending prompt: '{description}'")
    
    try:
        print("⏳ Waiting for response...")
        schema = await ai.generate_sql_schema(description)
        print("\n✅ Response Received!")
        print("-" * 50)
        print(schema)
        print("-" * 50)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_ai())
