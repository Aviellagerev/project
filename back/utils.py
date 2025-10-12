import os
import json
from datetime import datetime

def get_file_list(upload_folder):
    files = []
    if not os.path.exists(upload_folder): return files
    try:
        for filename in os.listdir(upload_folder):
            if filename.endswith('.meta.json'): continue
            filepath = os.path.join(upload_folder, filename)
            meta_path = f"{filepath}.meta.json"
            uploader, upload_time = 'Unknown', datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
            if os.path.exists(meta_path):
                try:
                    with open(meta_path) as f:
                        meta = json.load(f)
                        uploader = meta.get('uploader', uploader)
                        upload_time = meta.get('upload_time', upload_time)
                except (json.JSONDecodeError, IOError): pass
            files.append({'filename': filename, 'uploader': uploader, 'upload_time': upload_time, 'size': os.path.getsize(filepath)})
    except OSError: pass
    return sorted(files, key=lambda x: x['upload_time'], reverse=True)