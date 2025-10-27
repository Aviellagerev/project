import os

class Config:
    SECRET_KEY = os.urandom(24)
    DB_PATH = 'users.db'
    UPLOAD_FOLDER = 'shared_folder'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    MAX_EVENTS = 50

class DevelopmentConfig(Config):
    DEBUG = True