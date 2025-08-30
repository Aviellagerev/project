from flask import Flask, render_template, request, redirect, session, jsonify, send_from_directory, url_for
import sqlite3
import os
from datetime import datetime

UPLOAD_FOLDER = 'shared_folder'

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'your-secret-key'
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Folder to store uploaded files
UPLOAD_FOLDER = 'shared_folder'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Home route
@app.route('/', methods=['GET'])
def home():
    files = []
    for filename in os.listdir(UPLOAD_FOLDER):
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.isfile(filepath):
            upload_time = datetime.fromtimestamp(os.path.getmtime(filepath)).strftime('%Y-%m-%d')
            files.append({'filename': filename, 'upload_time': upload_time})
    return render_template('index.html', error=None, files=files)

# Login route
@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    
    conn = sqlite3.connect('users.db')
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username=? AND password=?', (username, password))
    result = c.fetchone()
    conn.close()
    
    if result:
        session['logged_in'] = True
        session['username'] = username
        return redirect('/')
    else:
        return render_template('index.html', error='Invalid credentials')

# Serve uploaded files for download
@app.route('/uploads/<filename>')
def download_file(filename):
    if not session.get('logged_in'):
        return "Unauthorized", 401
    return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)

# File upload route
@app.route('/upload', methods=['POST'])
def upload():
    if not session.get('logged_in'):
        return "Unauthorized", 401
    
    file = request.files['file']
    if file:
        file.save(os.path.join(UPLOAD_FOLDER, file.filename))
        upload_time = datetime.now().strftime("%d-%m-%Y")
        return jsonify({
            "filename": file.filename,
            "upload_time": upload_time
        })
    return '', 204

# Delte file route
@app.route('/delete/<filename>', methods=['DELETE'])
def delete_file(filename):
    if not session.get('logged_in'):
        return "Unauthorized", 401

    file_path = os.path.join(UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "File not found"}), 40

# Logout route (optional)
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))

# Run the app
if __name__ == '__main__':
    # Accessible from any machine in your network
    app.run(host='0.0.0.0', port=8000, debug=True)
