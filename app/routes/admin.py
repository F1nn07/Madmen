from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, abort
from flask_login import login_user, logout_user, login_required, current_user
from functools import wraps
from app.models import db, User, Service, Booking
from datetime import datetime, timedelta
from sqlalchemy import func
import logging

# Blueprint-ის შექმნა
admin_bp = Blueprint('admin', __name__)

# ========================
# SECURITY: Logging Setup
# ========================
logging.basicConfig(
    filename='admin_access.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# ========================
# SECURITY: Failed Attempts Tracking
# ========================
failed_attempts = {}  # IP → (attempts_count, last_attempt_time)

def check_failed_attempts(client_ip):
    """შეამოწმებს არის თუ არა IP დაბლოკილი"""
    if client_ip in failed_attempts:
        attempts, last_attempt = failed_attempts[client_ip]
        
        # თუ 5+ მცდელობა და 30 წუთი არ გასულა
        if attempts >= 5:
            time_passed = datetime.now() - last_attempt
            if time_passed < timedelta(minutes=30):
                logging.warning(f"🚫 BLOCKED IP ATTEMPT: {client_ip}")
                return False, time_passed
            else:
                # 30 წუთის შემდეგ გაასუფთავებ
                del failed_attempts[client_ip]
    
    return True, None

def record_failed_attempt(client_ip):
    """დაფიქსირებს წარუმატებელ მცდელობას"""
    if client_ip in failed_attempts:
        attempts, _ = failed_attempts[client_ip]
        failed_attempts[client_ip] = (attempts + 1, datetime.now())
    else:
        failed_attempts[client_ip] = (1, datetime.now())

def clear_failed_attempts(client_ip):
    """გაასუფთავებს წარუმატებელ მცდელობებს"""
    if client_ip in failed_attempts:
        del failed_attempts[client_ip]


# ========================
# Decorators (როლების შემოწმება)
# ========================
def admin_required(f):
    """მხოლოდ ადმინისთვის"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin():
            flash('წვდომა აკრძალულია! საჭიროა ადმინის უფლებები.', 'danger')
            return redirect(url_for('admin.login'))
        return f(*args, **kwargs)
    return decorated_function


def admin_or_reception_required(f):
    """ადმინისთვის ან რეცეფციისთვის"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('admin.login'))
        if not (current_user.is_admin() or current_user.is_reception()):
            flash('წვდომა აკრძალულია!', 'danger')
            return redirect(url_for('admin.dashboard'))
        return f(*args, **kwargs)
    return decorated_function


# ========================
# Authentication Routes (SECURED)
# ========================
@admin_bp.route('/login', methods=['GET', 'POST'])
def login():
    """ლოგინის გვერდი - SECURED VERSION"""
    if current_user.is_authenticated:
        return redirect(url_for('admin.dashboard'))
    
    client_ip = request.remote_addr
    
    # შეამოწმებს დაბლოკილია თუ არა
    is_allowed, time_passed = check_failed_attempts(client_ip)
    if not is_allowed:
        remaining_time = timedelta(minutes=30) - time_passed
        minutes_left = int(remaining_time.total_seconds() / 60)
        
        flash(f'ძალიან ბევრი წარუმატებელი მცდელობა! სცადეთ {minutes_left} წუთში.', 'danger')
        logging.warning(f"🚫 BLOCKED LOGIN PAGE ACCESS: {client_ip}")
        return render_template('admin/login.html'), 429
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        remember = request.form.get('remember', False)
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password) and user.is_active:
            # ✅ წარმატებული login
            clear_failed_attempts(client_ip)
            login_user(user, remember=remember)
            
            logging.info(f"✅ SUCCESSFUL LOGIN - IP: {client_ip}, User: {username}, Role: {user.role}")
            flash(f'კეთილი იყოს შენი მობრძანება, {user.get_full_name()}!', 'success')
            
            # Redirect-ი როლის მიხედვით
            next_page = request.args.get('next')
            return redirect(next_page or url_for('admin.dashboard'))
        else:
            # ❌ არასწორი credentials
            record_failed_attempt(client_ip)
            
            attempts_count = failed_attempts.get(client_ip, (0, None))[0]
            remaining = 5 - attempts_count
            
            logging.warning(f"❌ FAILED LOGIN - IP: {client_ip}, User: {username}, Attempts: {attempts_count}/5")
            
            if remaining > 0:
                flash(f'არასწორი იუზერნეიმი ან პაროლი! დარჩა {remaining} მცდელობა.', 'danger')
            else:
                flash('ძალიან ბევრი წარუმატებელი მცდელობა! დაბლოკილი ხართ 30 წუთით.', 'danger')
    
    return render_template('admin/login.html')


@admin_bp.route('/logout')
@login_required
def logout():
    """გასვლა"""
    username = current_user.username
    logging.info(f"🔓 LOGOUT - User: {username}")
    
    logout_user()
    flash('წარმატებით გახვედით სისტემიდან!', 'info')
    return redirect(url_for('admin.login'))


# ========================
# Dashboard
# ========================
@admin_bp.route('/dashboard')
@login_required
def dashboard():
    """მთავარი დაფა (Dashboard)"""
    today = datetime.utcnow().date()
    
    # სტატისტიკა
    if current_user.is_barber():
        # ბარბერი ხედავს მხოლოდ თავის სტატისტიკას
        today_bookings = Booking.query.filter(
            Booking.barber_id == current_user.id,
            func.date(Booking.start_time) == today
        ).count()
        
        pending_bookings = Booking.query.filter(
            Booking.barber_id == current_user.id,
            Booking.status == 'pending'
        ).count()
        
        total_bookings = Booking.query.filter_by(barber_id=current_user.id).count()
        
        recent_bookings = Booking.query.filter_by(barber_id=current_user.id)\
            .order_by(Booking.start_time.desc()).limit(5).all()
    else:
        # ადმინი და რეცეფცია ხედავენ ყველა სტატისტიკას
        today_bookings = Booking.query.filter(
            func.date(Booking.start_time) == today
        ).count()
        
        pending_bookings = Booking.query.filter_by(status='pending').count()
        total_bookings = Booking.query.count()
        
        recent_bookings = Booking.query.order_by(Booking.start_time.desc()).limit(5).all()
    
    total_barbers = User.query.filter_by(role='barber', is_active=True).count()
    total_services = Service.query.filter_by(is_active=True).count()
    
    stats = {
        'today_bookings': today_bookings,
        'pending_bookings': pending_bookings,
        'total_bookings': total_bookings,
        'total_barbers': total_barbers,
        'total_services': total_services
    }
    
    return render_template('admin/dashboard.html', 
                         stats=stats, 
                         recent_bookings=recent_bookings)


# ========================
# Bookings Management
# ========================
@admin_bp.route('/bookings')
@login_required
def bookings():
    """ჯავშნების კალენდარი"""
    # Get all active barbers for filter (Admin/Reception only)
    barbers = []
    if current_user.is_admin() or current_user.is_reception():
        barbers = User.query.filter_by(role='barber', is_active=True).all()
    
    return render_template('admin/bookings_calendar.html', barbers=barbers)


@admin_bp.route('/bookings/list')
@login_required
def bookings_list():
    """ჯავშნების სია (ცხრილის ხედი)"""
    page = request.args.get('page', 1, type=int)
    status_filter = request.args.get('status', 'all')
    
    if current_user.is_barber():
        # ბარბერი ხედავს მხოლოდ საკუთარ ჯავშნებს
        query = Booking.query.filter_by(barber_id=current_user.id)
    else:
        # ადმინი და რეცეფცია ხედავენ ყველაფერს
        query = Booking.query
    
    # სტატუსის ფილტრი
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    
    bookings = query.order_by(Booking.start_time.desc()).paginate(
        page=page, per_page=20, error_out=False
    )
    
    return render_template('admin/bookings_list.html', 
                         bookings=bookings, 
                         status_filter=status_filter)


@admin_bp.route('/bookings/new', methods=['GET', 'POST'])
@admin_or_reception_required
def booking_new():
    """ახალი ჯავშნის შექმნა"""
    from app.forms import BookingForm
    
    form = BookingForm()
    
    if request.method == 'POST':
        if form.validate_on_submit():
            try:
                # Get service to calculate end_time
                service = Service.query.get(form.service_id.data)
                if not service:
                    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return jsonify({
                            'success': False,
                            'error': 'სერვისი ვერ მოიძებნა'
                        }), 404
                    flash('სერვისი ვერ მოიძებნა', 'danger')
                    return redirect(url_for('admin.booking_new'))
                
                # Combine date and time
                booking_datetime = datetime.combine(
                    form.booking_date.data,
                    form.booking_time.data
                )
                end_datetime = booking_datetime + timedelta(minutes=service.duration)
                
                # Create booking
                new_booking = Booking(
                    service_id=form.service_id.data,
                    barber_id=form.barber_id.data,
                    start_time=booking_datetime,
                    end_time=end_datetime,
                    client_name=form.client_name.data,
                    client_phone=form.client_phone.data,
                    client_email=form.client_email.data,
                    # Alias fields for compatibility
                    customer_name=form.client_name.data,
                    customer_phone=form.client_phone.data,
                    customer_email=form.client_email.data,
                    notes=form.notes.data,
                    status=form.status.data
                )
                
                # Generate confirmation code
                new_booking.generate_confirmation_code()
                
                db.session.add(new_booking)
                db.session.commit()
                
                # Send email notification if email provided
                if form.client_email.data:
                    try:
                        from app.utils import send_booking_confirmation_email
                        send_booking_confirmation_email(new_booking)
                    except Exception as e:
                        logging.error(f'Email sending failed: {str(e)}')
                
                # Return JSON for AJAX requests
                if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({
                        'success': True,
                        'booking_id': new_booking.id,
                        'message': 'ჯავშანი წარმატებით შეიქმნა!'
                    })
                
                # Regular form submission
                flash('ჯავშანი წარმატებით შეიქმნა!', 'success')
                return redirect(url_for('admin.bookings'))
                
            except Exception as e:
                db.session.rollback()
                logging.error(f'Error creating booking: {str(e)}')
                
                if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({
                        'success': False,
                        'error': f'შეცდომა: {str(e)}'
                    }), 500
                
                flash(f'შეცდომა: {str(e)}', 'danger')
        else:
            # Form validation failed
            if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                errors = {}
                for field, error_list in form.errors.items():
                    errors[field] = error_list[0]
                
                return jsonify({
                    'success': False,
                    'errors': errors
                }), 400
    
    # GET request - return form HTML
    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # Pre-fill date and time from query params
        date = request.args.get('date')
        time = request.args.get('time')
        
        if date:
            form.booking_date.data = datetime.strptime(date, '%Y-%m-%d').date()
        if time:
            form.booking_time.data = datetime.strptime(time, '%H:%M').time()
        
        return render_template('admin/booking_modal_form.html', form=form, mode='create')
    
    # Regular page load
    return render_template('admin/booking_form.html', form=form, booking=None)


@admin_bp.route('/bookings/edit/<int:id>', methods=['GET', 'POST'])
@admin_or_reception_required
def booking_edit(id):
    """ჯავშნის რედაქტირება"""
    from app.forms import BookingForm
    
    booking = Booking.query.get_or_404(id)
    form = BookingForm(obj=booking)
    
    if request.method == 'GET':
        # Pre-fill form with booking data
        form.client_name.data = booking.client_name or booking.customer_name
        form.client_phone.data = booking.client_phone or booking.customer_phone
        form.client_email.data = booking.client_email or booking.customer_email
        form.service_id.data = booking.service_id
        form.barber_id.data = booking.barber_id
        form.notes.data = booking.notes
        form.status.data = booking.status
        
        if booking.start_time:
            form.booking_date.data = booking.start_time.date()
            form.booking_time.data = booking.start_time.time()
        elif booking.date and booking.time:
            form.booking_date.data = booking.date
            form.booking_time.data = booking.time
    
    if request.method == 'POST':
        if form.validate_on_submit():
            try:
                # Get service for duration
                service = Service.query.get(form.service_id.data)
                if not service:
                    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return jsonify({
                            'success': False,
                            'error': 'სერვისი ვერ მოიძებნა'
                        }), 404
                    flash('სერვისი ვერ მოიძებნა', 'danger')
                    return redirect(url_for('admin.booking_edit', id=id))
                
                # Update booking fields
                booking.service_id = form.service_id.data
                booking.barber_id = form.barber_id.data
                booking.client_name = form.client_name.data
                booking.client_phone = form.client_phone.data
                booking.client_email = form.client_email.data
                # Update alias fields
                booking.customer_name = form.client_name.data
                booking.customer_phone = form.client_phone.data
                booking.customer_email = form.client_email.data
                booking.notes = form.notes.data
                booking.status = form.status.data
                
                # Update datetime
                booking_datetime = datetime.combine(
                    form.booking_date.data,
                    form.booking_time.data
                )
                booking.start_time = booking_datetime
                booking.end_time = booking_datetime + timedelta(minutes=service.duration)
                
                db.session.commit()
                
                # Return JSON for AJAX
                if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({
                        'success': True,
                        'booking_id': booking.id,
                        'message': 'ჯავშანი წარმატებით განახლდა!'
                    })
                
                flash('ჯავშანი წარმატებით განახლდა!', 'success')
                return redirect(url_for('admin.bookings'))
                
            except Exception as e:
                db.session.rollback()
                logging.error(f'Error updating booking: {str(e)}')
                
                if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({
                        'success': False,
                        'error': f'შეცდომა: {str(e)}'
                    }), 500
                
                flash(f'შეცდომა: {str(e)}', 'danger')
        else:
            if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                errors = {}
                for field, error_list in form.errors.items():
                    errors[field] = error_list[0]
                
                return jsonify({
                    'success': False,
                    'errors': errors
                }), 400
    
    # GET request
    if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return render_template('admin/booking_modal_form.html', form=form, mode='edit', booking=booking)
    
    return render_template('admin/booking_form.html', form=form, booking=booking)


@admin_bp.route('/bookings/delete/<int:id>', methods=['POST', 'DELETE'])
@admin_or_reception_required
def booking_delete(id):
    """ჯავშნის წაშლა"""
    booking = Booking.query.get_or_404(id)
    
    try:
        db.session.delete(booking)
        db.session.commit()
        
        # Return JSON for AJAX
        if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': True,
                'message': 'ჯავშანი წარმატებით წაშლილია!'
            })
        
        flash('ჯავშანი წარმატებით წაშლილია!', 'success')
        return redirect(url_for('admin.bookings'))
        
    except Exception as e:
        db.session.rollback()
        logging.error(f'Error deleting booking: {str(e)}')
        
        if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({
                'success': False,
                'error': f'შეცდომა: {str(e)}'
            }), 500
        
        flash(f'შეცდომა: {str(e)}', 'danger')
        return redirect(url_for('admin.bookings'))


# ========================
# Users Management (Admin Only)
# ========================
@admin_bp.route('/users')
@admin_required
def users():
    """იუზერების სია"""
    users = User.query.order_by(User.created_at.desc()).all()
    return render_template('admin/users.html', users=users)


@admin_bp.route('/users/create', methods=['GET', 'POST'])
@admin_required
def user_create():
    """ახალი იუზერის შექმნა"""
    if request.method == 'POST':
        try:
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            first_name = request.form.get('first_name')
            last_name = request.form.get('last_name')
            phone = request.form.get('phone')
            role = request.form.get('role')
            specialization = request.form.get('specialization')
            
            # შემოწმება - იუზერნეიმი უნიკალურია
            if User.query.filter_by(username=username).first():
                flash('ეს იუზერნეიმი უკვე დაკავებულია!', 'danger')
                return redirect(url_for('admin.user_create'))
            
            new_user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                role=role,
                specialization=specialization
            )
            new_user.set_password(password)
            
            db.session.add(new_user)
            db.session.commit()
            
            logging.info(f"👤 NEW USER CREATED - Username: {username}, Role: {role}")
            flash('იუზერი წარმატებით შეიქმნა!', 'success')
            return redirect(url_for('admin.users'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'შეცდომა: {str(e)}', 'danger')
    
    return render_template('admin/user_form.html', user=None)


@admin_bp.route('/users/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def user_edit(id):
    """იუზერის რედაქტირება"""
    user = User.query.get_or_404(id)
    
    if request.method == 'POST':
        try:
            user.email = request.form.get('email')
            user.first_name = request.form.get('first_name')
            user.last_name = request.form.get('last_name')
            user.phone = request.form.get('phone')
            user.role = request.form.get('role')
            user.specialization = request.form.get('specialization')
            user.is_active = request.form.get('is_active') == 'on'
            
            # პაროლის შეცვლა (თუ მითითებულია)
            new_password = request.form.get('password')
            if new_password:
                user.set_password(new_password)
            
            db.session.commit()
            flash('იუზერი წარმატებით განახლდა!', 'success')
            return redirect(url_for('admin.users'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'შეცდომა: {str(e)}', 'danger')
    
    return render_template('admin/user_form.html', user=user)


@admin_bp.route('/users/delete/<int:id>', methods=['POST'])
@admin_required
def user_delete(id):
    """იუზერის წაშლა"""
    user = User.query.get_or_404(id)
    
    # არ დავუშვათ საკუთარი თავის წაშლა
    if user.id == current_user.id:
        flash('თქვენ არ შეგიძლიათ საკუთარი თავის წაშლა!', 'danger')
        return redirect(url_for('admin.users'))
    
    try:
        db.session.delete(user)
        db.session.commit()
        flash('იუზერი წარმატებით წაიშალა!', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'შეცდომა: {str(e)}', 'danger')
    
    return redirect(url_for('admin.users'))


# ========================
# Services Management (Admin Only)
# ========================
@admin_bp.route('/services')
@admin_required
def services():
    """მომსახურებების სია"""
    services = Service.query.order_by(Service.created_at.desc()).all()
    return render_template('admin/services.html', services=services)


@admin_bp.route('/services/create', methods=['GET', 'POST'])
@admin_required
def service_create():
    """ახალი მომსახურების შექმნა"""
    if request.method == 'POST':
        try:
            name = request.form.get('name')
            description = request.form.get('description')
            price = float(request.form.get('price'))
            duration = int(request.form.get('duration'))
            
            new_service = Service(
                name=name,
                description=description,
                price=price,
                duration=duration
            )
            
            db.session.add(new_service)
            db.session.commit()
            
            flash('მომსახურება წარმატებით შეიქმნა!', 'success')
            return redirect(url_for('admin.services'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'შეცდომა: {str(e)}', 'danger')
    
    return render_template('admin/service_form.html', service=None)


@admin_bp.route('/services/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def service_edit(id):
    """მომსახურების რედაქტირება"""
    service = Service.query.get_or_404(id)
    
    if request.method == 'POST':
        try:
            service.name = request.form.get('name')
            service.description = request.form.get('description')
            service.price = float(request.form.get('price'))
            service.duration = int(request.form.get('duration'))
            service.is_active = request.form.get('is_active') == 'on'
            
            db.session.commit()
            flash('მომსახურება წარმატებით განახლდა!', 'success')
            return redirect(url_for('admin.services'))
            
        except Exception as e:
            db.session.rollback()
            flash(f'შეცდომა: {str(e)}', 'danger')
    
    return render_template('admin/service_form.html', service=service)


@admin_bp.route('/services/delete/<int:id>', methods=['POST'])
@admin_required
def service_delete(id):
    """მომსახურების წაშლა"""
    service = Service.query.get_or_404(id)
    
    try:
        db.session.delete(service)
        db.session.commit()
        flash('მომსახურება წარმატებით წაიშალა!', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'შეცდომა: {str(e)}', 'danger')
    
    return redirect(url_for('admin.services'))


# ========================
# Statistics (Admin Only)
# ========================
@admin_bp.route('/statistics')
@admin_required
def statistics():
    """სტატისტიკა"""
    # დღევანდელი სტატისტიკა
    today = datetime.utcnow().date()
    today_bookings = Booking.query.filter(func.date(Booking.start_time) == today).count()
    
    # წლიური სტატისტიკა
    year_start = datetime(datetime.utcnow().year, 1, 1)
    yearly_bookings = Booking.query.filter(Booking.created_at >= year_start).count()
    
    # ბარბერების რეიტინგი
    barber_stats = db.session.query(
        User.first_name,
        User.last_name,
        func.count(Booking.id).label('booking_count')
    ).join(Booking, User.id == Booking.barber_id)\
     .filter(User.role == 'barber')\
     .group_by(User.id)\
     .order_by(func.count(Booking.id).desc())\
     .all()
    
    # პოპულარული მომსახურებები
    popular_services = db.session.query(
        Service.name,
        func.count(Booking.id).label('booking_count')
    ).join(Booking, Service.id == Booking.service_id)\
     .group_by(Service.id)\
     .order_by(func.count(Booking.id).desc())\
     .limit(5).all()
    
    stats = {
        'today_bookings': today_bookings,
        'yearly_bookings': yearly_bookings,
        'barber_stats': barber_stats,
        'popular_services': popular_services
    }
    
    now = datetime.now()
    
    return render_template('admin/statistics.html', stats=stats, now=now)