import os
from flask import Flask

def create_app(config_object='back.config.DevelopmentConfig'):
    package_root = os.path.dirname(os.path.abspath(__file__))

    app = Flask(
        __name__.split('.')[0],
        instance_relative_config=True,
        template_folder=os.path.join(package_root, 'templates'),
        static_folder=os.path.join(package_root, 'static')
    )

    app.config.from_object(config_object)

    try:
        os.makedirs(app.instance_path)
        os.makedirs(app.config['UPLOAD_FOLDER'])
    except OSError:
        pass

    from . import database
    database.init_app(app)

    from . import auth, files, admin, events
    app.register_blueprint(auth.auth_bp)
    app.register_blueprint(files.files_bp)
    app.register_blueprint(admin.admin_bp)
    app.register_blueprint(events.events_bp)

    return app