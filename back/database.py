import sqlite3
import os
from flask import g, current_app
from werkzeug.security import generate_password_hash

def get_db():
    if 'db' not in g:
        db_path = os.path.join(current_app.instance_path, current_app.config['DB_PATH'])
        g.db = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db_path = os.path.join(current_app.instance_path, current_app.config['DB_PATH'])
    if not os.path.exists(db_path):
        db = get_db()
        with current_app.open_resource('schema.sql') as f:
            db.executescript(f.read().decode('utf8'))
        db.execute(
            'INSERT INTO users (username, password_hash, permissions) VALUES (?, ?, ?)',
            ('admin', generate_password_hash('admin'), 'admin')
        )
        db.commit()
        print("Initialized the database and created a default admin user.")

def init_app(app):
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db()