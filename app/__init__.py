from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

# Rate Limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

def create_app(config_name=None):
    """Application Factory"""
    
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    limiter.init_app(app)  # ახალი!
    
    # Login manager settings
    login_manager.login_view = 'admin.login'
    login_manager.login_message = 'გთხოვთ გაიაროთ ავტორიზაცია.'
    
    # User loader
    from app.models import User
    
    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))
    
    # Import models
    with app.app_context():
        from app import models
    
    # Register blueprints
    from app.routes.main import main as main_bp
    app.register_blueprint(main_bp)
    
    # Admin blueprint with custom URL prefix
  # Admin blueprint with custom URL prefix
    ADMIN_URL = os.getenv('ADMIN_URL_PATH', 'madmen-secure-admin-2024')
    try:
        from app.routes.admin import admin_bp
        app.register_blueprint(admin_bp, url_prefix=f'/{ADMIN_URL}')
    except ImportError:
        pass
    
    # API blueprint
    try:
        from app.routes.api import api_bp
        app.register_blueprint(api_bp)
    except ImportError:
        pass
    
    return app