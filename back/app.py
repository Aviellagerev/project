from flask import Flask, render_template, request, redirect, session, jsonify, send_from_directory, url_for, Response
import sqlite3
import os
import json
import time
import threading
from datetime import datetime

# Configuration
UPLOAD_FOLDER = 'shared_folder'
MAX_EVENTS = 50  # Limit event history to prevent memory bloat
DB_PATH = 'users.db'

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)  # More secure random key
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Limit uploads to 16MB

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Simple in-memory event queue (for low number of concurrent users)
event_queue = []
event_lock = threading.Lock()

def get_file_list():
    """Efficiently get list of files with metadata"""
    files = []
    try:
        for filename in os.listdir(UPLOAD_FOLDER):
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(filepath):
                upload_time = datetime.fromtimestamp(
                    os.path.getmtime(filepath)
                ).strftime('%Y-%m-%d')
                files.append({
                    'filename': filename,
                    'upload_time': upload_time,
                    'size': os.path.getsize(filepath)
                })
    except OSError:
        pass  # Handle directory access errors silently
    return files

def add_event(event_type, file_data=None):
    """Add an event to the queue, limiting size"""
    with event_lock:
        event = {
            'type': event_type,
            'file': file_data,
            'timestamp': time.time()
        }
        event_queue.append(event)
        # Keep only the most recent events
        if len(event_queue) > MAX_EVENTS:
            event_queue.pop(0)

def get_events_since(timestamp):
    """Get events since a specific timestamp"""
    with event_lock:
        return [e for e in event_queue if e['timestamp'] > timestamp]

# Database connection helper
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Home route
@app.route('/', methods=['GET'])
def home():
    # Clear session on page load to ensure fresh start
    if 'logged_in' in session and not request.referrer:
        session.clear()
    
    files = get_file_list() if session.get('logged_in') else []
    return render_template('index.html', error=None, files=files,
                         user_name=session.get('username'), logged_in=session.get('logged_in', False))

# List files route (fallback for non-SSE clients)
@app.route('/list', methods=['GET'])
def list_files():
    if not session.get('logged_in'):
        return jsonify({'error': 'Unauthorized'}), 401
    return jsonify({'files': get_file_list()})

# Login route
@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute(
            'SELECT * FROM users WHERE username=? AND password=?',
            (username, password)
        )
        result = c.fetchone()
        conn.close()
        if result:
            session['logged_in'] = True
            session['username'] = username
            return redirect('/')
        else:
            return render_template('index.html', error='Invalid credentials',
                                 files=[], user_name=None, logged_in=False), 401
    except sqlite3.Error:
        return render_template('index.html', error='Database error',
                             files=[], user_name=None, logged_in=False), 500

# Serve uploaded files for download
@app.route('/Uploads/<filename>')
def download_file(filename):
    if not session.get('logged_in'):
        return "Unauthorized", 401
    if '..' in filename or filename.startswith('/'):
        return "Invalid filename", 400
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

# File upload route
@app.route('/upload', methods=['POST'])
def upload():
    if not session.get('logged_in'):
        return "Unauthorized", 401
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file and file.filename:
        filename = os.path.basename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        try:
            file.save(filepath)
            upload_time = datetime.now().strftime("%d-%m-%Y")
            file_data = {
                "filename": filename,
                "upload_time": upload_time,
                "size": os.path.getsize(filepath)
            }
            add_event('file_added', file_data)
            return jsonify(file_data)
        except IOError:
            return jsonify({'error': 'Failed to save file'}), 500
    return jsonify({'error': 'Invalid file'}), 400

# Delete file route
@app.route('/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    if not session.get('logged_in'):
        return "Unauthorized", 401
    if '..' in filename or filename.startswith('/'):
        return jsonify({"success": False, "error": "Invalid filename"}), 400
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
            add_event('file_deleted', {'filename': filename})
            return jsonify({"success": True})
        except OSError:
            return jsonify({"success": False, "error": "Could not delete file"}), 500
    else:
        return jsonify({"success": False, "error": "File not found"}), 404

# Server-Sent Events route for real-time updates
@app.route('/events')
def events():
    if not session.get('logged_in'):
        return "Unauthorized", 401
    def generate():
        files = get_file_list()
        yield f"data: {json.dumps({'type': 'init', 'files': files})}\n\n"
        last_check = time.time()
        while True:
            time.sleep(2.0)
            current_events = get_events_since(last_check)
            last_check = time.time()
            for event in current_events:
                yield f"data: {json.dumps(event)}\n\n"
    return Response(generate(), mimetype="text/event-stream")

# Logout route
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# Health check endpoint for monitoring
@app.route('/health')
def health():
    return jsonify({"status": "ok", "timestamp": time.time()})

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=8000,
        debug=False,
        threaded=True,
        processes=1
    )