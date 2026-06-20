import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_uipath_scopes(scope_list):
    client_id = os.getenv("UIPATH_CLIENT_ID")
    client_secret = os.getenv("UIPATH_CLIENT_SECRET")
    TOKEN_URL = "https://cloud.uipath.com/identity_/connect/token"
    
    print(f"Testing client credentials with scopes: {scope_list}")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            payload = {
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            }
            if scope_list:
                payload["scope"] = scope_list
                
            response = await client.post(
                TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}\n")
    except Exception as e:
        print(f"Error: {e}\n")

async def main():
    # Test 1: Full scope list
    await test_uipath_scopes(
        "OR.Jobs OR.Jobs.Read OR.Jobs.Write "
        "OR.Execution OR.Execution.Read OR.Execution.Write "
        "OR.Folders OR.Folders.Read "
        "OR.Robots OR.Robots.Read"
    )
    
    # Test 2: No scope specified
    await test_uipath_scopes(None)

if __name__ == "__main__":
    asyncio.run(main())
