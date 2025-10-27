from werkzeug.security import generate_password_hash, check_password_hash

class User:
    def __init__(self, id, username, password_hash, permissions):
        self.id = id
        self.username = username
        self.password_hash = password_hash
        self.permissions = permissions

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)