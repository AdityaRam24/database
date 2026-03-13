import httpx
import asyncio

async def test_upload():
    url = "http://127.0.0.1:8000/api/connect-db/upload-sql?project_name=MyTestApp"
    
    with open("dummy.sql", "w") as f:
        f.write("CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(50));")
        
    async with httpx.AsyncClient() as client:
        with open("dummy.sql", "rb") as f:
            files = {"file": ("dummy.sql", f, "text/plain")}
            response = await client.post(url, files=files)
            print("STATUS:", response.status_code)
            print("RESPONSE:", response.json())

try:
    asyncio.run(test_upload())
except Exception as e:
    print("FAILED:", e)
