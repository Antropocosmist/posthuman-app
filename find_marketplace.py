
import subprocess
import json
import time

def scan_code_id(code_id):
    print(f"Scanning Code ID {code_id}...")
    cmd = [
        "curl", "-s", "-X", "GET",
        f"https://rest.stargaze-apis.com/cosmwasm/wasm/v1/code/{code_id}/contracts?pagination.limit=1",
        "-H", "accept: application/json"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        data = json.loads(result.stdout)
        contracts = data.get("contracts", [])
        if contracts:
            addr = contracts[0]
            print(f"Code {code_id} has contract: {addr}")
            # Query config to see if it looks like marketplace
            check_contract(addr)
    except Exception as e:
        print(f"Error scanning {code_id}: {e}")

def check_contract(addr):
    cmd = [
        "curl", "-s", "-X", "GET",
        f"https://rest.stargaze-apis.com/cosmwasm/wasm/v1/contract/{addr}/smart/eyJjb25maWciOnt9fQ==",
        "-H", "accept: application/json"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if "data" in result.stdout:
            print(f"Contract {addr} Config: {result.stdout[:200]}")
    except:
        pass

# Scan range likely to contain Marketplace V2
# Vending Minter is 16. SG721 is 15.
# Marketplace might be earlier or later.
for i in range(1, 100):
    scan_code_id(i)
    time.sleep(0.5)
