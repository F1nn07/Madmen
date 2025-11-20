import os
import logging
from flask import Blueprint, jsonify, request, url_for, current_app
from flask_login import login_required, current_user
from app.models import User, BarberSchedule, Booking, Service, Barber, Client
from app import db
from datetime import datetime, timedelta, time
from sqlalchemy import and_

api_bp = Blueprint('api', __name__, url_prefix='/api')

# ========================
# HELPER FUNCTIONS
# ========================

def get_real_barber_id(user_id):
    """User ID-ს გარდაქმნის Barber ID-ად"""
    user = User.query.get(user_id)
    if user and user.barber:
        return user.barber.id
    return None

def generate_time_slots(start_time, end_time, interval_minutes=30):
    slots = []
    current = datetime.combine(datetime.today(), start_time)
    end = datetime.combine(datetime.today(), end_time)
    while current < end:
        slots.append(current.strftime('%H:%M'))
        current += timedelta(minutes=interval_minutes)
    return slots

def is_slot_available(barber_id, date, time_slot, service_duration):
    """ამოწმებს არის თუ არა სლოტი თავისუფალი"""
    try:
        slot_time = datetime.strptime(time_slot, '%H:%M').time()
        slot_start = datetime.combine(date, slot_time)
        slot_end = slot_start + timedelta(minutes=service_duration)
        
        overlapping_bookings = Booking.query.filter(
            and_(
                Booking.barber_id == barber_id,
                Booking.status != 'cancelled',
                Booking.start_time != None,
                Booking.start_time < slot_end,
                Booking.end_time > slot_start
            )
        ).first()
        
        return overlapping_bookings is None
    except ValueError:
        return False

# ========================
# PUBLIC ENDPOINTS
# ========================

@api_bp.route('/barbers', methods=['GET'])
def get_barbers():
    try:
        users = User.query.filter_by(role='barber', is_active=True).all()
        barbers_list = []
        for user in users:
            image_src = None
            name = user.get_full_name()
            specialization = user.specialization or "ბარბერი"
            
            if user.barber:
                if user.barber.name != name:
                    user.barber.name = name
                    db.session.commit()

                if user.barber.image_url:
                    full_path = os.path.join(current_app.root_path, 'static', user.barber.image_url)
                    if os.path.exists(full_path):
                        image_src = url_for('static', filename=user.barber.image_url)
                
                if user.barber.specialties:
                    specialization = user.barber.specialties

            barbers_list.append({
                'id': user.id, # Frontend-ს ვაძლევთ User ID-ს
                'name': name,
                'specialization': specialization,
                'image': image_src
            })
        return jsonify({'success': True, 'barbers': barbers_list})
    except Exception as e:
        logging.error(f"API ERROR (get_barbers): {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/services', methods=['GET'])
def get_services():
    try:
        services = Service.query.filter_by(is_active=True).all()
        services_list = [{
            'id': s.id,
            'name': s.name,
            'description': s.description,
            'price': s.price,
            'duration': s.duration
        } for s in services]
        return jsonify({'success': True, 'services': services_list})
    except Exception as e:
        logging.error(f"API ERROR (get_services): {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/available-slots/<int:barber_id>/<string:date>', methods=['GET'])
def get_available_slots(barber_id, date):
    try:
        booking_date = datetime.strptime(date, '%Y-%m-%d').date()
        if booking_date < datetime.now().date():
            return jsonify({'success': False, 'error': 'წარსული თარიღი'}), 400
        
        barber_user = User.query.get(barber_id)
        if not barber_user: return jsonify({'success': False, 'error': 'ბარბერი ვერ მოიძებნა'}), 404

        # Vacation Check
        if barber_user.barber and barber_user.barber.vacation_start and barber_user.barber.vacation_end:
            v_start = barber_user.barber.vacation_start
            v_end = barber_user.barber.vacation_end
            if v_start <= booking_date <= v_end:
                return_date = v_end + timedelta(days=1)
                return jsonify({
                    'success': True,
                    'is_working': False,
                    'message': f"ბარბერი შვებულებაშია. ბრუნდება: {return_date.strftime('%d.%m.%Y')}-ში",
                    'slots': {'morning': [], 'afternoon': [], 'evening': []}
                })

        # Schedule Check
        day_of_week = booking_date.weekday()
        schedule = BarberSchedule.query.filter_by(
            barber_id=barber_id, day_of_week=day_of_week, is_working=True
        ).first()
        
        if not schedule:
            return jsonify({
                'success': True,
                'is_working': False,
                'message': f'ბარბერი არ მუშაობს {BarberSchedule.get_day_name(day_of_week)}-ს',
                'slots': {'morning': [], 'afternoon': [], 'evening': []}
            })
        
        service_id = request.args.get('service_id', type=int)
        interval = request.args.get('interval', default=30, type=int)
        service_duration = 30
        if service_id:
            service = Service.query.get(service_id)
            if service: service_duration = service.duration
        
        all_slots = generate_time_slots(schedule.start_time, schedule.end_time, interval)
        current_datetime = datetime.now()
        available_slots = []
        
        # Real Barber ID for slot check
        real_barber_id = get_real_barber_id(barber_id)
        
        for slot in all_slots:
            try:
                slot_time_obj = datetime.strptime(slot, '%H:%M').time()
                slot_full_datetime = datetime.combine(booking_date, slot_time_obj)
                if slot_full_datetime <= current_datetime: continue
                
                if is_slot_available(real_barber_id, booking_date, slot, service_duration):
                    available_slots.append(slot)
            except ValueError: continue
        
        morning_slots = [s for s in available_slots if int(s.split(':')[0]) < 12]
        afternoon_slots = [s for s in available_slots if 12 <= int(s.split(':')[0]) < 17]
        evening_slots = [s for s in available_slots if int(s.split(':')[0]) >= 17]
        
        return jsonify({
            'success': True,
            'is_working': True,
            'slots': {'morning': morning_slots, 'afternoon': afternoon_slots, 'evening': evening_slots}
        })
        
    except Exception as e:
        logging.error(f"API ERROR (get_slots): {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/clients/lookup', methods=['POST'])
def lookup_client():
    try:
        data = request.get_json()
        phone = data.get('phone', '').replace(' ', '').replace('-', '').replace('+', '')
        if not phone: return jsonify({'found': False})

        client = Client.query.filter_by(phone=phone).first()
        if client:
            last_booking = Booking.query.filter_by(client_id=client.id)\
                .filter(Booking.status != 'cancelled')\
                .order_by(Booking.start_time.desc())\
                .first()
            
            last_visit_info = None
            if last_booking and last_booking.start_time:
                service_name = last_booking.service.name if last_booking.service else 'უცნობი სერვისი'
                barber_name = "უცნობი ოსტატი"
                if last_booking.barber:
                    barber_name = last_booking.barber.name

                last_visit_info = {
                    'date': last_booking.start_time.strftime('%d.%m.%Y'),
                    'barber': barber_name,
                    'service': service_name
                }

            return jsonify({
                'found': True,
                'name': client.name,
                'email': client.email,
                'is_blocked': client.is_blocked,
                'last_visit': last_visit_info
            })
            
        return jsonify({'found': False})
    except Exception as e:
        logging.error(f"Client lookup error: {str(e)}")
        return jsonify({'found': False}), 500

@api_bp.route('/bookings/create', methods=['POST'])
def create_booking():
    try:
        data = request.get_json()
        required = ['service_id', 'barber_id', 'date', 'time', 'customer_name', 'customer_phone']
        for field in required:
            if field not in data: return jsonify({'success': False, 'error': f'აკლია ველი: {field}'}), 400

        service = Service.query.get(data['service_id'])
        user_barber = User.query.get(data['barber_id'])
        
        if not service or not user_barber: 
            return jsonify({'success': False, 'error': 'მონაცემები ვერ მოიძებნა'}), 404

        real_barber_id = get_real_barber_id(user_barber.id)
        if not real_barber_id:
             return jsonify({'success': False, 'error': 'ბარბერის პროფილი არ არსებობს'}), 400

        raw_phone = data['customer_phone']
        clean_phone = raw_phone.replace(' ', '').replace('-', '').replace('+', '')
        
        client = Client.query.filter_by(phone=clean_phone).first()
        if client and client.is_blocked:
            return jsonify({'success': False, 'error': 'შეზღუდული გაქვთ ჯავშნის გაკეთება'}), 403
            
        if not client:
            client = Client(phone=clean_phone, name=data['customer_name'], email=data.get('customer_email'))
            db.session.add(client)
            db.session.flush()
        else:
            client.name = data['customer_name']
            if data.get('customer_email'): client.email = data.get('customer_email')

        booking_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        booking_time = datetime.strptime(data['time'], '%H:%M').time()
        start_datetime = datetime.combine(booking_date, booking_time)
        end_datetime = start_datetime + timedelta(minutes=service.duration)
        
        if not is_slot_available(real_barber_id, booking_date, data['time'], service.duration):
             return jsonify({'success': False, 'error': 'დრო უკვე დაკავებულია'}), 409

        new_booking = Booking(
            service_id=data['service_id'],
            barber_id=real_barber_id,
            client_id=client.id,
            start_time=start_datetime,
            end_time=end_datetime,
            price=service.price,
            customer_name=data['customer_name'],
            customer_phone=clean_phone,
            customer_email=data.get('customer_email'),
            notes=data.get('notes'),
            client_name=data['customer_name'],
            client_phone=clean_phone,
            client_email=data.get('customer_email'),
            status='pending'
        )
        
        new_booking.generate_confirmation_code()
        db.session.add(new_booking)
        db.session.commit()
        
        return jsonify({'success': True, 'booking_id': new_booking.id, 'message': 'წარმატებით შეიქმნა'})

    except Exception as e:
        db.session.rollback()
        logging.error(f"API ERROR (create_booking): {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ========================
# ADMIN API
# ========================
@api_bp.route('/admin/all-bookings', methods=['GET'])
@login_required
def get_all_bookings():
    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        barber_filter = request.args.get('barber_id')
        
        query = Booking.query
        
        if current_user.is_barber():
            if current_user.barber:
                query = query.filter_by(barber_id=current_user.barber.id)
            else:
                return jsonify([])
        
        if start_str and end_str:
            start_str = start_str.replace(' ', '+').replace('Z', '+00:00')
            end_str = end_str.replace(' ', '+').replace('Z', '+00:00')
            start_dt = datetime.fromisoformat(start_str)
            end_dt = datetime.fromisoformat(end_str)
            query = query.filter(Booking.start_time >= start_dt, Booking.start_time <= end_dt)

        if barber_filter:
            try:
                real_id = get_real_barber_id(int(barber_filter))
                if real_id: query = query.filter_by(barber_id=real_id)
            except: pass

        bookings = query.all()
        events = []
        
        for b in bookings:
            color = '#f59e0b'
            if b.status == 'confirmed': color = '#10b981'
            elif b.status == 'cancelled': color = '#ef4444'
            elif b.status == 'completed': color = '#3b82f6'

            events.append({
                'id': b.id,
                'title': f"{b.customer_name}",
                'start': b.start_time.isoformat(),
                'end': b.end_time.isoformat(),
                'backgroundColor': color,
                'borderColor': color,
                'extendedProps': {
                    'customerName': b.customer_name,
                    'customerPhone': b.customer_phone,
                    'serviceName': b.service.name,
                    'servicePrice': b.price,
                    'serviceDuration': b.service.duration,
                    'barberName': b.barber.name if b.barber else 'Unknown',
                    'status': b.status,
                    'notes': b.notes
                }
            })
        return jsonify(events)
    except Exception as e:
        logging.error(f"API ERROR (calendar): {str(e)}")
        return jsonify([])

@api_bp.route('/admin/bookings/<int:booking_id>/update-status', methods=['PATCH'])
@login_required
def update_booking_status(booking_id):
    try:
        if not (current_user.is_admin() or current_user.is_reception()):
            return jsonify({'success': False, 'error': 'No access'}), 403
        
        booking = Booking.query.get_or_404(booking_id)
        data = request.get_json()
        booking.status = data.get('status')
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@api_bp.route('/admin/bookings/<int:booking_id>/update-datetime', methods=['PATCH'])
@login_required
def update_booking_datetime(booking_id):
    try:
        if not (current_user.is_admin() or current_user.is_reception()):
            return jsonify({'success': False, 'error': 'No access'}), 403
        
        booking = Booking.query.get_or_404(booking_id)
        data = request.get_json()
        
        start_str = data['start_time'].replace('Z', '+00:00')
        end_str = data['end_time'].replace('Z', '+00:00')
        new_start = datetime.fromisoformat(start_str)
        new_end = datetime.fromisoformat(end_str)
        
        overlapping = Booking.query.filter(
            Booking.id != booking_id,
            Booking.barber_id == booking.barber_id,
            Booking.status.in_(['pending', 'confirmed']),
            Booking.start_time < new_end,
            Booking.end_time > new_start
        ).first()
        
        if overlapping:
            return jsonify({'success': False, 'error': 'დრო დაკავებულია'}), 400
        
        booking.start_time = new_start
        booking.end_time = new_end
        db.session.commit()
        
        logging.info(f"📅 Booking {booking.id} moved by {current_user.username}")
        return jsonify({'success': True})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500