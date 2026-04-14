import httpx, asyncio
async def test():
    async with httpx.AsyncClient() as c:
        try:
            r = await c.post('http://localhost:11434/api/chat', json={'model': 'moondream', 'messages': [{'role': 'user', 'content': 'test', 'images': ['R0lGODlhAQABAAAAACw=']}], 'stream': False}, timeout=120.0)
            print("Status:", r.status_code)
            print("Body:", r.text)
        except Exception as e:
            print("Python Exception:", e)
asyncio.run(test())
