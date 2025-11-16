from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.models import User, BarberSchedule, Booking, Service
from app import db
from datetime import datetime, timedelta, time
from sqlalchemy import and_

api_bp = Blueprint('api', __name__, url_prefix='/api')


def generate_time_slots(start_time, end_time, interval_minutes=30):
    """გენერირებს დროის სლოტებს"""
    slots = []
    current = datetime.combine(datetime.today(), start_time)
    end = datetime.combine(datetime.today(), end_time)
    
    while current < end:
        slots.append(current.strftime('%H:%M'))
        current += timedelta(minutes=interval_minutes)
    
    return slots


def is_slot_available(barber_id, date, time_slot, service_duration):
    """ამოწმებს არის თუ არა სლოტი თავისუფალი"""
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


@api_bp.route('/available-slots/<int:barber_id>/<string:date>', methods=['GET'])
def get_available_slots(barber_id, date):
    """აბრუნებს ხელმისაწვდომ დროის სლოტებს"""
    try:
        booking_date = datetime.strptime(date, '%Y-%m-%d').date()
        
        if booking_date < datetime.now().date():
            return jsonify({
                'success': False,
                'error': 'არ შეიძლება წარსულში ჯავშნის შექმნა'
            }), 400
        
        barber = User.query.get(barber_id)
        if not barber or not barber.is_barber():
            return jsonify({
                'success': False,
                'error': 'ბარბერი ვერ მოიძებნა'
            }), 404
        
        day_of_week = booking_date.weekday()
        
        schedule = BarberSchedule.query.filter_by(
            barber_id=barber_id,
            day_of_week=day_of_week,
            is_working=True
        ).first()
        
        if not schedule:
            return jsonify({
                'success': True,
                'date': date,
                'barber_id': barber_id,
                'barber_name': barber.get_full_name(),
                'is_working': False,
                'message': f'ბარბერი არ მუშაობს {BarberSchedule.get_day_name(day_of_week)}-ს',
                'slots': {
                    'morning': [],
                    'afternoon': [],
                    'evening': []
                }
            })
        
        service_id = request.args.get('service_id', type=int)
        interval = request.args.get('interval', default=30, type=int)
        
        service_duration = 30
        if service_id:
            service = Service.query.get(service_id)
            if service:
                service_duration = service.duration
        
        all_slots = generate_time_slots(
            schedule.start_time,
            schedule.end_time,
            interval
        )
        
        available_slots = [
            slot for slot in all_slots
            if is_slot_available(barber_id, booking_date, slot, service_duration)
        ]
        
        morning_slots = []
        afternoon_slots = []
        evening_slots = []
        
        for slot in available_slots:
            hour = int(slot.split(':')[0])
            if hour < 12:
                morning_slots.append(slot)
            elif hour < 17:
                afternoon_slots.append(slot)
            else:
                evening_slots.append(slot)
        
        return jsonify({
            'success': True,
            'date': date,
            'day_of_week': day_of_week,
            'day_name': BarberSchedule.get_day_name(day_of_week),
            'barber_id': barber_id,
            'barber_name': barber.get_full_name(),
            'is_working': True,
            'work_hours': {
                'start': schedule.start_time.strftime('%H:%M'),
                'end': schedule.end_time.strftime('%H:%M')
            },
            'service_duration': service_duration,
            'slots': {
                'morning': morning_slots,
                'afternoon': afternoon_slots,
                'evening': evening_slots
            },
            'total_available': len(available_slots)
        })
        
    except ValueError:
        return jsonify({
            'success': False,
            'error': 'არასწორი თარიღის ფორმატი'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'შეცდომა: {str(e)}'
        }), 500


@api_bp.route('/admin/all-bookings', methods=['GET'])
@login_required
def get_all_bookings():
    """
    აბრუნებს ყველა ჯავშანს FullCalendar-compatible ფორმატში
    
    Role-based Access:
        - Admin/Reception: ყველა ჯავშანი
        - Barber: მხოლოდ საკუთარი ჯავშნები
    
    Query Parameters (optional):
        - start: ISO datetime (filtering by date range)
        - end: ISO datetime (filtering by date range)
        - barber_id: filter by specific barber (admin/reception only)
    
    Returns:
        JSON Array: [
            {
                "id": 1,
                "title": "გიორგი გ. - თმის შეჭრა",
                "start": "2025-11-29T14:00:00",
                "end": "2025-11-29T14:30:00",
                "barberId": 3,
                "barberName": "დავით ტემურიანი",
                "serviceName": "კლასიკური თმის შეჭრა",
                "customerName": "გიორგი გიორგაძე",
                "customerPhone": "599123456",
                "status": "pending",
                "backgroundColor": "#B07D4A",
                "borderColor": "#C724B1"
            }
        ]
    """
    try:
        # Check user role and filter accordingly
        if current_user.is_admin() or current_user.is_reception():
            # Admin/Reception sees all bookings
            query = Booking.query
            
            # Optional: filter by specific barber
            barber_id = request.args.get('barber_id', type=int)
            if barber_id:
                query = query.filter_by(barber_id=barber_id)
                
        elif current_user.is_barber():
            # Barber sees only their own bookings
            query = Booking.query.filter_by(barber_id=current_user.id)
        else:
            return jsonify({
                'success': False,
                'error': 'არ გაქვთ წვდომა'
            }), 403
        
        # Optional: filter by date range (for FullCalendar's date navigation)
        start_date = request.args.get('start')
        end_date = request.args.get('end')
        
        if start_date and end_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(
                    Booking.start_time >= start_dt,
                    Booking.start_time <= end_dt
                )
            except ValueError:
                pass  # Invalid date format, skip filtering
        
        # Get bookings
        bookings = query.order_by(Booking.start_time.desc()).all()
        
        # Format for FullCalendar
        events = []
        status_colors = {
            'pending': {'bg': '#f59e0b', 'border': '#d97706'},      # Orange
            'confirmed': {'bg': '#10b981', 'border': '#059669'},    # Green
            'completed': {'bg': '#3b82f6', 'border': '#2563eb'},    # Blue
            'cancelled': {'bg': '#6b7280', 'border': '#4b5563'}     # Gray
        }
        
        for booking in bookings:
            # Get customer name (support both field names)
            customer_name = booking.client_name or booking.customer_name or 'უცნობი'
            
            # Get barber name
            barber_name = booking.barber.name if booking.barber else 'ნებისმიერი'
            
            # Create title
            title = f"{customer_name} - {booking.service.name}"
            
            # Get colors based on status
            colors = status_colors.get(booking.status, status_colors['pending'])
            
            # Format event
            event = {
                'id': booking.id,
                'title': title,
                'start': booking.start_time.isoformat() if booking.start_time else None,
                'end': booking.end_time.isoformat() if booking.end_time else None,
                'barberId': booking.barber_id,
                'barberName': barber_name,
                'serviceId': booking.service_id,
                'serviceName': booking.service.name,
                'servicePrice': booking.service.price,
                'serviceDuration': booking.service.duration,
                'customerName': customer_name,
                'customerPhone': booking.client_phone or booking.customer_phone,
                'customerEmail': booking.client_email or booking.customer_email,
                'notes': booking.notes,
                'status': booking.status,
                'confirmationCode': booking.confirmation_code,
                'backgroundColor': colors['bg'],
                'borderColor': colors['border'],
                'textColor': '#ffffff'
            }
            
            events.append(event)
        
        return jsonify(events)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'შეცდომა: {str(e)}'
        }), 500


@api_bp.route('/admin/bookings/<int:booking_id>/update-status', methods=['PATCH'])
@login_required
def update_booking_status(booking_id):
    """
    განაახლებს ჯავშნის სტატუსს
    
    Request Body:
        {
            "status": "confirmed" | "pending" | "completed" | "cancelled"
        }
    """
    try:
        # Check permissions
        if not (current_user.is_admin() or current_user.is_reception()):
            return jsonify({
                'success': False,
                'error': 'არ გაქვთ წვდომა'
            }), 403
        
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({
                'success': False,
                'error': 'ჯავშანი ვერ მოიძებნა'
            }), 404
        
        data = request.get_json()
        new_status = data.get('status')
        
        valid_statuses = ['pending', 'confirmed', 'completed', 'cancelled']
        if new_status not in valid_statuses:
            return jsonify({
                'success': False,
                'error': 'არასწორი სტატუსი'
            }), 400
        
        booking.status = new_status
        db.session.commit()
        
        return jsonify({
            'success': True,
            'booking_id': booking.id,
            'status': booking.status,
            'message': 'სტატუსი განახლდა'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'შეცდომა: {str(e)}'
        }), 500


@api_bp.route('/barbers', methods=['GET'])
def get_barbers():
    """აბრუნებს ყველა აქტიურ ბარბერს"""
    try:
        barbers = User.query.filter_by(role='barber', is_active=True).all()
        
        barbers_list = [{
            'id': b.id,
            'name': b.get_full_name(),
            'specialization': b.specialization
        } for b in barbers]
        
        return jsonify({
            'success': True,
            'barbers': barbers_list
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/services', methods=['GET'])
def get_services():
    """აბრუნებს ყველა აქტიურ სერვისს"""
    try:
        services = Service.query.filter_by(is_active=True).all()
        
        services_list = [{
            'id': s.id,
            'name': s.name,
            'description': s.description,
            'price': s.price,
            'duration': s.duration
        } for s in services]
        
        return jsonify({
            'success': True,
            'services': services_list
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@api_bp.route('/bookings/create', methods=['POST'])
def create_booking():
    """
    ქმნის ახალ ჯავშანს
    
    Request Body:
        {
            "service_id": 1,
            "barber_id": 3,
            "date": "2025-11-29",
            "time": "14:00",
            "customer_name": "გიორგი გიორგაძე",
            "customer_phone": "599123456",
            "customer_email": "email@example.com",
            "notes": "დამატებითი კომენტარები"
        }
    
    Returns:
        JSON: {
            "success": true,
            "booking_id": 123,
            "confirmation_code": "MAD-ABC123",
            "message": "ჯავშანი წარმატებით შეიქმნა"
        }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['service_id', 'barber_id', 'date', 'time', 'customer_name', 'customer_phone']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'ველი {field} სავალდებულოა'
                }), 400
        
        # Get service to calculate duration
        service = Service.query.get(data['service_id'])
        if not service:
            return jsonify({
                'success': False,
                'error': 'სერვისი ვერ მოიძებნა'
            }), 404
        
        # Verify barber exists
        barber = User.query.get(data['barber_id'])
        if not barber or not barber.is_barber():
            return jsonify({
                'success': False,
                'error': 'ბარბერი ვერ მოიძებნა'
            }), 404
        
        # Parse date and time
        booking_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        booking_time = datetime.strptime(data['time'], '%H:%M').time()
        
        # Create datetime objects
        start_datetime = datetime.combine(booking_date, booking_time)
        end_datetime = start_datetime + timedelta(minutes=service.duration)
        
        # Check if slot is still available
        if not is_slot_available(data['barber_id'], booking_date, data['time'], service.duration):
            return jsonify({
                'success': False,
                'error': 'ეს დრო უკვე დაკავებულია'
            }), 409
        
        # Create booking
        new_booking = Booking(
            service_id=data['service_id'],
            barber_id=data['barber_id'],
            start_time=start_datetime,
            end_time=end_datetime,
            customer_name=data['customer_name'],
            customer_phone=data['customer_phone'],
            customer_email=data.get('customer_email'),
            notes=data.get('notes'),
            # Also populate alias fields for admin panel compatibility
            client_name=data['customer_name'],
            client_phone=data['customer_phone'],
            client_email=data.get('customer_email'),
            status='pending'
        )
        
        # Generate confirmation code
        confirmation_code = new_booking.generate_confirmation_code()
        
        db.session.add(new_booking)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'booking_id': new_booking.id,
            'confirmation_code': confirmation_code,
            'message': 'ჯავშანი წარმატებით შეიქმნა'
        }), 201
        
    except ValueError:
        return jsonify({
            'success': False,
            'error': 'არასწორი თარიღის ან დროის ფორმატი'
        }), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'error': f'შეცდომა: {str(e)}'
        }), 500
    
    # დაამატე ეს კოდი api.py-ის ბოლოში (სხვა endpoints-ების შემდეგ)

@api_bp.route('/bookings/calendar', methods=['GET'])
@login_required
def get_calendar_bookings():
    """
    კალენდრისთვის ჯავშნების მონაცემები
    
    Query Parameters:
        - year: int (required) - წელი
        - month: int (required) - თვე (1-12)
        - barber_id: int (optional) - კონკრეტული ბარბერის ფილტრი
        - status: str (optional) - სტატუსის ფილტრი
    """
    try:
        # Get query parameters
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        barber_id = request.args.get('barber_id', type=int)
        status = request.args.get('status', type=str)
        
        if not year or not month:
            return jsonify({
                'success': False,
                'error': 'წელი და თვე სავალდებულოა'
            }), 400
        
        # Calculate date range for the month
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1)
        else:
            end_date = datetime(year, month + 1, 1)
        
        # Build query based on user role
        if current_user.is_barber():
            # Barber sees only their bookings
            query = Booking.query.filter_by(barber_id=current_user.id)
        else:
            # Admin/Reception see all bookings
            query = Booking.query
        
        # Filter by date range
        query = query.filter(
            Booking.start_time >= start_date,
            Booking.start_time < end_date
        )
        
        # Optional filters
        if barber_id:
            query = query.filter_by(barber_id=barber_id)
        
        if status:
            query = query.filter_by(status=status)
        
        # Get bookings
        bookings = query.order_by(Booking.start_time).all()
        
        # Format bookings for calendar
        bookings_data = []
        for booking in bookings:
            # Get client name (support both field names)
            client_name = booking.client_name or booking.customer_name or 'უცნობი'
            
            # Get service name
            service_name = booking.service.name if booking.service else 'N/A'
            
            # Get barber name
            if booking.barber:
                barber_name = booking.barber.get_full_name()
            else:
                barber_name = 'ნებისმიერი'
            
            bookings_data.append({
                'id': booking.id,
                'date': booking.start_time.strftime('%Y-%m-%d') if booking.start_time else None,
                'time': booking.start_time.strftime('%H:%M') if booking.start_time else None,
                'client_name': client_name,
                'service_name': service_name,
                'barber_name': barber_name,
                'barber_id': booking.barber_id,
                'status': booking.status,
                'phone': booking.client_phone or booking.customer_phone
            })
        
        return jsonify({
            'success': True,
            'bookings': bookings_data,
            'total': len(bookings_data)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'შეცდომა: {str(e)}'
        }), 500
    
    # დაამატე ეს api.py ფაილში (api_bp blueprint-ში)

@api_bp.route('/admin/bookings/<int:booking_id>/update-datetime', methods=['PATCH'])
@login_required
def update_booking_datetime(booking_id):
    """
    განაახლებს ჯავშნის დროს (Drag & Drop)
    
    Request Body:
        {
            "start_time": "2024-11-16T10:00:00",
            "end_time": "2024-11-16T11:00:00"
        }
    """
    try:
        # Check permissions
        if not (current_user.is_admin() or current_user.is_reception()):
            return jsonify({
                'success': False,
                'error': 'არ გაქვთ წვდომა'
            }), 403
        
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({
                'success': False,
                'error': 'ჯავშანი ვერ მოიძებნა'
            }), 404
        
        data = request.get_json()
        new_start_str = data.get('start_time')
        new_end_str = data.get('end_time')
        
        if not new_start_str or not new_end_str:
            return jsonify({
                'success': False,
                'error': 'არასრული მონაცემები'
            }), 400
        
        # Parse datetime strings
        from datetime import datetime
        try:
            new_start = datetime.fromisoformat(new_start_str.replace('Z', '+00:00'))
            new_end = datetime.fromisoformat(new_end_str.replace('Z', '+00:00'))
        except ValueError as e:
            return jsonify({
                'success': False,
                'error': f'არასწორი თარიღის ფორმატი: {str(e)}'
            }), 400
        
        # Validation: Check if new time slot is available
        overlapping = Booking.query.filter(
            Booking.id != booking_id,
            Booking.barber_id == booking.barber_id,
            Booking.status.in_(['pending', 'confirmed']),
            Booking.start_time < new_end,
            Booking.end_time > new_start
        ).first()
        
        if overlapping:
            return jsonify({
                'success': False,
                'error': f'ეს დრო დაკავებულია (ჯავშანი #{overlapping.id})'
            }), 400
        
        # Update booking
        old_start = booking.start_time
        old_end = booking.end_time
        
        booking.start_time = new_start
        booking.end_time = new_end
        
        # Update legacy fields too (if they exist)
        if hasattr(booking, 'date') and hasattr(booking, 'time'):
            booking.date = new_start.date()
            booking.time = new_start.time()
        
        db.session.commit()
        
        # Log the change
        import logging
        logging.info(
            f"📅 BOOKING MOVED - ID: {booking_id}, "
            f"User: {current_user.username}, "
            f"From: {old_start} - {old_end}, "
            f"To: {new_start} - {new_end}"
        )
        
        return jsonify({
            'success': True,
            'booking_id': booking.id,
            'new_start': new_start.isoformat(),
            'new_end': new_end.isoformat(),
            'message': 'ჯავშანი წარმატებით გადატანილია'
        })
        
    except Exception as e:
        db.session.rollback()
        import logging
        logging.error(f'Error updating booking datetime: {str(e)}')
        return jsonify({
            'success': False,
            'error': f'შეცდომა: {str(e)}'
        }), 500