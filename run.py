import os
import sys
import logging
from datetime import datetime
from app import create_app

# ========================
# COLORED LOGGING SETUP
# ========================

class ColoredFormatter(logging.Formatter):
    """ფერადი ლოგები Terminal-ში"""
    
    # ANSI escape codes for colors
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m'        # Reset
    }
    
    # Emoji icons
    ICONS = {
        'DEBUG': '🔍',
        'INFO': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'CRITICAL': '🚨'
    }
    
    def format(self, record):
        # Get color and icon
        color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
        icon = self.ICONS.get(record.levelname, '📝')
        reset = self.COLORS['RESET']
        
        # Format timestamp
        timestamp = datetime.fromtimestamp(record.created).strftime('%H:%M:%S')
        
        # Format message
        log_message = f"{color}{icon} [{timestamp}] {record.levelname}{reset} - {record.getMessage()}"
        
        # Add exception info if present
        if record.exc_info:
            log_message += f"\n{self.formatException(record.exc_info)}"
        
        return log_message


def setup_logging():
    """კონფიგურაცია advanced logging-ისთვის"""
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(ColoredFormatter())
    root_logger.addHandler(console_handler)
    
    # File handler for errors (optional)
    error_handler = logging.FileHandler('logs/errors.log', encoding='utf-8')
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    root_logger.addHandler(error_handler)
    
    # File handler for all logs (optional)
    all_handler = logging.FileHandler('logs/app.log', encoding='utf-8')
    all_handler.setLevel(logging.INFO)
    all_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    root_logger.addHandler(all_handler)
    
    # Reduce noise from werkzeug
    logging.getLogger('werkzeug').setLevel(logging.WARNING)


# ========================
# REQUEST/RESPONSE LOGGING MIDDLEWARE
# ========================

def setup_request_logging(app):
    """Request/Response logging"""
    
    @app.before_request
    def log_request():
        from flask import request
        
        # Skip static files
        if request.path.startswith('/static'):
            return
        
        logging.info(f"📥 REQUEST: {request.method} {request.path}")
        
        # Log query params
        if request.args:
            logging.debug(f"   Query Params: {dict(request.args)}")
        
        # Log form data (excluding passwords)
        if request.form:
            safe_form = {k: v for k, v in request.form.items() if 'password' not in k.lower()}
            if safe_form:
                logging.debug(f"   Form Data: {safe_form}")
    
    @app.after_request
    def log_response(response):
        from flask import request
        
        # Skip static files
        if request.path.startswith('/static'):
            return response
        
        # Color based on status code
        status = response.status_code
        if status < 300:
            emoji = '✅'
        elif status < 400:
            emoji = '➡️'
        elif status < 500:
            emoji = '⚠️'
        else:
            emoji = '❌'
        
        logging.info(f"📤 RESPONSE: {emoji} {status} {request.method} {request.path}")
        
        return response
    
    @app.errorhandler(Exception)
    def log_exception(e):
        logging.error(f"💥 EXCEPTION: {type(e).__name__}: {str(e)}", exc_info=True)
        raise


# ========================
# STARTUP BANNER
# ========================

def print_startup_banner(app):
    """ლამაზი startup banner"""
    
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              🔥 MAD-MEN BARBERFLOW SYSTEM 🔥                 ║
║                                                              ║
║  💈 Barbershop Booking & Management System                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

📊 SYSTEM INFORMATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   🌍 Environment:     {app.config.get('ENV', 'development').upper()}
   🔧 Debug Mode:      {'✅ ENABLED' if app.debug else '❌ DISABLED'}
   🏠 Host:            {app.config.get('SERVER_NAME', '0.0.0.0:5001')}
   🗄️  Database:        {app.config.get('SQLALCHEMY_DATABASE_URI', 'N/A').split('://')[0] if app.config.get('SQLALCHEMY_DATABASE_URI') else 'N/A'}
   📁 Templates:       {os.path.abspath(app.template_folder)}
   📦 Static Files:    {os.path.abspath(app.static_folder)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 AVAILABLE ENDPOINTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   🌐 Main Website:     http://localhost:5001/
   🔐 Admin Panel:      http://localhost:5001/admin/login
   📅 Bookings:         http://localhost:5001/booking
   📊 API:              http://localhost:5001/api/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 FEATURES:
   ✅ FullCalendar Integration
   ✅ Role-based Access Control (Admin, Barber, Reception)
   ✅ Email Notifications
   ✅ Real-time Booking System
   ✅ Statistics & Analytics
   ✅ Modern UI with Tailwind CSS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Server is starting...
⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

"""
    print(banner)


# ========================
# PERFORMANCE MONITORING
# ========================

def setup_performance_monitoring(app):
    """Request performance monitoring"""
    
    @app.before_request
    def start_timer():
        from flask import g
        import time
        g.start_time = time.time()
    
    @app.after_request
    def log_performance(response):
        from flask import g, request
        import time
        
        # Skip static files
        if request.path.startswith('/static'):
            return response
        
        if hasattr(g, 'start_time'):
            elapsed = (time.time() - g.start_time) * 1000  # ms
            
            # Color based on response time
            if elapsed < 100:
                emoji = '⚡'  # Fast
            elif elapsed < 500:
                emoji = '🚀'  # Normal
            elif elapsed < 1000:
                emoji = '🐢'  # Slow
            else:
                emoji = '🐌'  # Very slow
            
            logging.debug(f"{emoji} Performance: {elapsed:.2f}ms - {request.method} {request.path}")
        
        return response


# ========================
# ROUTE LISTING
# ========================

def list_routes(app):
    """ყველა route-ის სია"""
    
    logging.info("📋 Registered Routes:")
    logging.info("━" * 80)
    
    routes = []
    for rule in app.url_map.iter_rules():
        if rule.endpoint != 'static':
            methods = ', '.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
            routes.append({
                'endpoint': rule.endpoint,
                'methods': methods,
                'path': str(rule)
            })
    
    # Sort by path
    routes.sort(key=lambda x: x['path'])
    
    # Group by blueprint
    current_blueprint = None
    for route in routes:
        blueprint = route['endpoint'].split('.')[0] if '.' in route['endpoint'] else 'main'
        
        if blueprint != current_blueprint:
            current_blueprint = blueprint
            logging.info(f"\n📦 {blueprint.upper()}:")
        
        logging.info(f"   {route['methods']:20s} {route['path']}")
    
    logging.info("━" * 80)


# ========================
# MAIN APPLICATION
# ========================

os.makedirs('logs', exist_ok=True)

# Setup logging
setup_logging()

# Create Flask app
app = create_app()

# Setup middleware
setup_request_logging(app)
setup_performance_monitoring(app)

# Print startup info
print_startup_banner(app)
list_routes(app)

# Run application
if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )