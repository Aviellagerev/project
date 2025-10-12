from flask import Flask, render_template, request, redirect, session, jsonify, send_from_directory, url_for, Response
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import json
import time
import threading
from datetime import datetime
from functools import wraps

# --- Configuration ---
UPLOAD_FOLDER = 'shared_folder'
MAX_EVENTS = 50
DB_PATH = 'users.db'

# --- Initialize Flask App ---
app = Flask(__name__)
app.secret_key = os.urandom(24)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Event Queues for Real-time Updates ---
file_event_queue = []
file_event_lock = threading.Lock()
admin_event_queue = []
admin_event_lock = threading.Lock()
user_event_queues = {}
user_event_lock = threading.Lock()

# --- Hierarchical Permission System ---
PERMISSION_LEVELS = {
    'read': 1,
    'write': 2,
    'delete': 3,
    'admin': 4
}

def permission_required(required_level_str):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_permission_str = session.get('permissions', 'read')
            user_level = PERMISSION_LEVELS.get(user_permission_str, 0)
            required_level = PERMISSION_LEVELS.get(required_level_str, 5)

            if user_level >= required_level:
                return f(*args, **kwargs)
            else:
                return jsonify({'error': f"'{required_level_str}' permission required."}), 403
        return decorated_function
    return decorator

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('home'))
        return f(*args, **kwargs)
    return decorated_function

# --- Helper Functions ---
def get_db_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def save_file_metadata(filename, username, folder=UPLOAD_FOLDER):
    meta = { "uploader": username, "upload_time": datetime.now().isoformat() }
    meta_path = os.path.join(folder, f"{filename}.meta.json")
    with open(meta_path, 'w') as f: json.dump(meta, f)

def get_file_list():
    files = []
    try:
        filenames = [f for f in os.listdir(UPLOAD_FOLDER) if not f.endswith('.meta.json')]
        for filename in filenames:
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(filepath):
                meta_path = f"{filepath}.meta.json"
                uploader, upload_time = 'Unknown', datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path) as f:
                            meta = json.load(f)
                            uploader = meta.get('uploader', uploader)
                            upload_time = meta.get('upload_time', upload_time)
                    except (json.JSONDecodeError, IOError): pass
                files.append({
                    'filename': filename, 'uploader': uploader,
                    'upload_time': upload_time, 'size': os.path.getsize(filepath)
                })
    except OSError: pass
    return sorted(files, key=lambda x: x['upload_time'], reverse=True)

def add_file_event(event_type, file_data=None):
    with file_event_lock:
        event = {'type': event_type, 'file': file_data, 'timestamp': time.time()}
        file_event_queue.append(event)
        if len(file_event_queue) > MAX_EVENTS: file_event_queue.pop(0)

def add_user_event(username, event_type, data=None):
    with user_event_lock:
        if username not in user_event_queues: user_event_queues[username] = []
        event = {'type': event_type, 'data': data, 'timestamp': time.time()}
        user_event_queues[username].append(event)
        if len(user_event_queues[username]) > 10: user_event_queues[username].pop(0)

def add_admin_event(event_type, data=None):
    with admin_event_lock:
        event = {'type': event_type, 'data': data, 'timestamp': time.time()}
        admin_event_queue.append(event)
        if len(admin_event_queue) > MAX_EVENTS: admin_event_queue.pop(0)

# --- Main Route ---
@app.route('/')
def home():
    files = get_file_list() if session.get('logged_in') else []
    return render_template('index.html',
                         error=session.pop('error', None),
                         success=session.pop('success', None),
                         files=files, user_name=session.get('username'),
                         logged_in=session.get('logged_in', False),
                         permissions=session.get('permissions', ''))

# --- Authentication ---
@app.route('/register', methods=['POST'])
def register():
    username, password = request.form['username'], request.form['password']
    if not username or not password:
        session['error'] = 'Username and password are required.'
        return redirect(url_for('home'))
    hashed_password = generate_password_hash(password)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO users (username, password_hash, permissions) VALUES (?, ?, ?)', (username, hashed_password, 'read'))
        new_user_id = cursor.lastrowid
        conn.commit()
        new_user = {'id': new_user_id, 'username': username, 'permissions': 'read'}
        add_admin_event('user_registered', new_user)
        session['success'] = 'Registration successful! Please log in.'
    except sqlite3.IntegrityError: session['error'] = 'Username already exists.'
    finally:
        if conn: conn.close()
    return redirect(url_for('home'))

@app.route('/login', methods=['POST'])
def login():
    username, password = request.form['username'], request.form['password']
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    if user and check_password_hash(user['password_hash'], password):
        session['logged_in'], session['username'], session['user_id'], session['permissions'] = True, user['username'], user['id'], user['permissions']
        return redirect(url_for('home'))
    else:
        session['error'] = 'Invalid username or password.'
        return redirect(url_for('home'))

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# --- File Management ---
@app.route('/Uploads/<filename>')
@login_required
@permission_required('read')
def download_file(filename):
    if '..' in filename or filename.startswith('/'): return "Invalid filename", 400
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

@app.route('/upload', methods=['POST'])
@login_required
@permission_required('write')
def upload():
    if 'file' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = os.path.basename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        save_file_metadata(filename, session['username'])
        file_data = {
            "filename": filename, "upload_time": datetime.now().isoformat(),
            "size": os.path.getsize(filepath), "uploader": session.get('username')
        }
        add_file_event('file_added', file_data)
        return jsonify(file_data), 201
    return jsonify({'error': 'Invalid file'}), 400

@app.route('/delete/<filename>', methods=['DELETE'])
@login_required
@permission_required('delete')
def delete_file(filename):
    if '..' in filename or filename.startswith('/'): return jsonify({"error": "Invalid filename"}), 400
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    meta_path = f"{file_path}.meta.json"
    if os.path.exists(file_path):
        os.remove(file_path)
        if os.path.exists(meta_path): os.remove(meta_path)
        add_file_event('file_deleted', {'filename': filename})
        return jsonify({"success": True})
    return jsonify({"error": "File not found"}), 404

# --- Admin & Session Routes ---
@app.route('/admin')
@login_required
@permission_required('admin')
def admin_panel():
    return render_template('admin.html', user_name=session.get('username'))

@app.route('/api/users')
@login_required
@permission_required('admin')
def get_users():
    conn = get_db_connection()
    users = conn.execute('SELECT id, username, permissions FROM users').fetchall()
    conn.close()
    return jsonify([dict(user) for user in users])

@app.route('/api/update_permission', methods=['POST'])
@login_required
@permission_required('admin')
def update_permission():
    data = request.get_json()
    user_id, new_permission = data.get('id'), data.get('permission')
    if not user_id or new_permission not in ['read', 'write', 'delete', 'admin']:
        return jsonify({'error': 'Invalid data provided'}), 400
    conn = get_db_connection()
    user_to_edit = conn.execute('SELECT username FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user_to_edit:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    if user_to_edit['username'] == session.get('username'):
        conn.close()
        return jsonify({'error': "Cannot change your own permissions."}), 403
    conn.execute('UPDATE users SET permissions = ? WHERE id = ?', (new_permission, user_id))
    conn.commit()
    conn.close()
    add_user_event(user_to_edit['username'], 'permission_updated', {'new_permission': new_permission})
    return jsonify({'success': True})

@app.route('/api/delete_user/<int:user_id>', methods=['DELETE'])
@login_required
@permission_required('admin')
def delete_user(user_id):
    conn = get_db_connection()
    user_to_delete = conn.execute('SELECT username FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user_to_delete:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    if user_to_delete['username'] == session.get('username'):
        conn.close()
        return jsonify({'error': "You cannot delete yourself."}), 403
    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    add_admin_event('user_deleted', {'id': user_id})
    return jsonify({'success': True})

@app.route('/api/refresh_session')
@login_required
def refresh_session():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'error': 'User not in session'}), 400
    
    conn = get_db_connection()
    user = conn.execute('SELECT permissions FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    
    if user:
        new_permission = user['permissions']
        session['permissions'] = new_permission
        return jsonify({'success': True, 'permissions': new_permission})
    
    return jsonify({'success': False, 'error': 'User not found in DB'}), 404

# --- SSE Route for Real-time Updates ---
@app.route('/events')
def events():
    if 'logged_in' not in session: return Response(status=204)
    username = session.get('username')
    is_admin = session.get('permissions') == 'admin'
    def generate():
        last_file_check = last_admin_check = last_user_check = time.time()
        try:
            while True:
                # File events (broadcast to all)
                with file_event_lock:
                    recent_events = [e for e in file_event_queue if e['timestamp'] > last_file_check]
                last_file_check = time.time()
                for event in recent_events:
                    yield f"data: {json.dumps(event)}\n\n"
                
                # User-specific events (broadcast to all connections for that user)
                if username:
                    with user_event_lock:
                        user_queue = user_event_queues.get(username, [])
                        user_events = [e for e in user_queue if e['timestamp'] > last_user_check]
                    last_user_check = time.time()
                    for event in user_events:
                        yield f"data: {json.dumps(event)}\n\n"

                # Admin events (broadcast to all admins)
                if is_admin:
                    with admin_event_lock:
                        recent_admin_events = [e for e in admin_event_queue if e['timestamp'] > last_admin_check]
                    last_admin_check = time.time()
                    for event in recent_admin_events:
                        yield f"data: {json.dumps(event)}\n\n"
                        
                time.sleep(1)
        except GeneratorExit: pass
    return Response(generate(), mimetype="text/event-stream")

def setup_database():
    if not os.path.exists(DB_PATH):
        print("Database not found. Creating and seeding a new one.")
        conn = get_db_connection()
        conn.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL, permissions TEXT NOT NULL DEFAULT 'read'
            );
        ''')
        conn.execute('INSERT INTO users (username, password_hash, permissions) VALUES (?, ?, ?)', 
                     ('admin', generate_password_hash('admin'), 'admin'))
        conn.commit()
        conn.close()
        print("Database created successfully.")

if __name__ == '__main__':
    setup_database()
    app.run(host='0.0.0.0', port=8000, debug=True)
#change 7
