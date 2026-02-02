
import subprocess
import json
import sys

# Bech32 charset
charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
base_addr_parts = ["stars1fvhcnyddukcqf87l2u9z6f", "xm8e9gnv7qusmdnhaq363wwr5dapq2y05v9"]

def check_address(char):
    addr = base_addr_parts[0] + char + base_addr_parts[1]
    cmd = [
        "curl", "-s", "-X", "GET",
        f"https://rest.stargaze-apis.com/cosmwasm/wasm/v1/contract/{addr}/smart/eyJjb25maWciOnt9fQ==",
        "-H", "accept: application/json"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        # Check if output is not bech32 error
        if "decoding bech32 failed" not in result.stdout:
            print(f"FOUND MATCH: {addr}")
            print(f"Response: {result.stdout}")
            return True
    except Exception as e:
        pass
    return False

print("Brute forcing address...")
for c in charset:
    if check_address(c):
        break
