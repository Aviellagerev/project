import os

class Config:
    # Read the key from an environment variable
    # If it's not set, raise an error so the app won't start
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("No SECRET_KEY set for production app. Set the environment variable.")
    
    DB_PATH = 'users.db'
    UPLOAD_FOLDER = 'shared_folder'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    MAX_EVENTS = 50

class DevelopmentConfig(Config):
    DEBUG = True