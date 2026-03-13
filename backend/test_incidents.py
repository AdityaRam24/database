import requests
import time
import json

URL = "http://localhost:8000/api/incidents/scan"
conn_str = "postgresql://postgres:root@localhost:5432/testdb" # or similar just to test schema

print("Testing /api/incidents/scan")

for i in range(3):
    print(f"Scan {i+1}...")
    res = requests.post(URL, json={"connection_string": conn_str})
    if res.status_code == 200:
        data = res.json()
        print(f"Status: {data.get('status')} - Snapshots: {data.get('snapshot_count')}")
        if data.get('status') == 'success':
            print("Summary: ", data.get('summary'))
            print("Incidents: ", len(data.get('incidents')))
            if data.get('incidents'):
                print("First incident: ", data['incidents'][0]['type'], data['incidents'][0]['severity_level'])
    else:
        print("Error: ", res.text)
    
    time.sleep(1)
