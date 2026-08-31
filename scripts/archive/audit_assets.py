import os
import struct

def get_png_dimensions(file_path):
    try:
        with open(file_path, 'rb') as f:
            data = f.read(24)
            if data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR':
                w, h = struct.unpack('>LL', data[16:24])
                return w, h
    except Exception as e:
        return None, None
    return None, None

def format_size(size):
    if size < 1024 * 1024:
        return f"{size / 1024:.2f} KB"
    return f"{size / (1024 * 1024):.2f} MB"

assets_dir = r"C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\assets\images"
app_json_refs = [
    "./assets/images/icon.png",
    "./assets/images/adaptive-icon.png",
    "./assets/images/favicon.png",
    "./assets/images/splash-image.png"
]

print("| Asset | Path | Dimensions | Size KB/MB | Referenced? | Status |")
print("| ----- | ---- | ---------- | ---------- | ----------- | ------ |")

for file_name in os.listdir(assets_dir):
    if not file_name.endswith('.png'):
        continue
    file_path = os.path.join(assets_dir, file_name)
    size = os.path.getsize(file_path)
    w, h = get_png_dimensions(file_path)
    dim_str = f"{w}x{h}" if w and h else "Unknown"
    
    ref_path = f"./assets/images/{file_name}"
    is_ref = "Yes" if ref_path in app_json_refs else "No"
    
    status = "OK"
    if size > 3 * 1024 * 1024:
        status = "WARN: Large size"
    if file_name == "icon.png" and dim_str != "1024x1024":
        status = "WARN: Not 1024x1024"
    if file_name == "adaptive-icon.png" and dim_str != "1024x1024":
        status = "WARN: Not 1024x1024"
    if file_name == "favicon.png" and w and w > 512:
        status = "WARN: Favicon too large"
    if not w or not h:
        status = "ERR: Invalid PNG"
        
    print(f"| {file_name} | {ref_path} | {dim_str} | {format_size(size)} | {is_ref} | {status} |")
