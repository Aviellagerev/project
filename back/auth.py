from functools import wraps
from flask import (
    Blueprint, request, render_template, redirect, url_for, session, jsonify
)
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

from .database import get_db
from .events import add_admin_event

auth_bp = Blueprint('auth', __name__)

PERMISSION_LEVELS = { 'read': 1, 'write': 2, 'delete': 3, 'admin': 4 }

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required'}), 401
            return redirect(url_for('auth.home'))
        return f(*args, **kwargs)
    return decorated_function

def permission_required(required_level_str):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_level = PERMISSION_LEVELS.get(session.get('permissions', 'read'), 0)
            required_level = PERMISSION_LEVELS.get(required_level_str, 5)
            if user_level >= required_level:
                return f(*args, **kwargs)
            return jsonify({'error': f"'{required_level_str}' permission required."}), 403
        return decorated_function
    return decorator

@auth_bp.route('/')
def home():
    if session.get('logged_in'):
        return redirect(url_for('files.file_manager'))
    return render_template('index.html', logged_in=False, error=session.pop('error', None), success=session.pop('success', None))

@auth_bp.route('/register', methods=['POST'])
def register():
    username, password = request.form['username'], request.form['password']
    if not username or not password:
        session['error'] = 'Username and password are required.'
        return redirect(url_for('auth.home'))
    hashed_password = generate_password_hash(password)
    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', (username, hashed_password))
        db.commit()
        add_admin_event('user_registered', {'id': cursor.lastrowid, 'username': username, 'permissions': 'read'})
        session['success'] = 'Registration successful! Please log in.'
    except sqlite3.IntegrityError:
        session['error'] = 'Username already exists.'
    return redirect(url_for('auth.home'))

@auth_bp.route('/login', methods=['POST'])
def login():
    username, password = request.form['username'], request.form['password']
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if user and check_password_hash(user['password_hash'], password):
        session.clear()
        session['logged_in'] = True
        session['username'] = user['username']
        session['user_id'] = user['id']
        session['permissions'] = user['permissions']
        return redirect(url_for('files.file_manager'))
    session['error'] = 'Invalid username or password.'
    return redirect(url_for('auth.home'))

@auth_bp.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('auth.home'))

@auth_bp.route('/api/refresh_session')
@login_required
def refresh_session():
    user_id = session.get('user_id')
    db = get_db()
    user = db.execute('SELECT permissions FROM users WHERE id = ?', (user_id,)).fetchone()
    if user:
        session['permissions'] = user['permissions']
        return jsonify({'success': True, 'permissions': user['permissions']})
    return jsonify({'success': False, 'error': 'User not found'}), 404