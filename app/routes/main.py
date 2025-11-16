from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.models import Booking, Service, Barber
from app import db
from datetime import datetime

main = Blueprint('main', __name__)

@main.route('/')
def index():
    """მთავარი გვერდი"""
    return render_template('index.html')

@main.route('/services')
def services():
    """სერვისების გვერდი"""
    services = Service.query.all()
    return render_template('services.html', services=services)

@main.route('/barbers')
def barbers():
    """ბარბერების გვერდი"""
    try:
        barbers = Barber.query.all()
        return render_template('barbers.html', barbers=barbers)
    except Exception as e:
        flash(f'შეცდომა: {str(e)}', 'error')
        return render_template('barbers.html', barbers=[])

@main.route('/gallery')
def gallery():
    """გალერეის გვერდი"""
    return render_template('gallery.html')

@main.route('/contact', methods=['GET', 'POST'])
def contact():
    """კონტაქტის გვერდი"""
    if request.method == 'POST':
        # კონტაქტის ფორმის დამუშავება
        name = request.form.get('name')
        email = request.form.get('email')
        phone = request.form.get('phone')
        subject = request.form.get('subject')
        message = request.form.get('message')
        
        # TODO: შეტყობინების გაგზავნა ელ.ფოსტაზე
        
        flash('თქვენი შეტყობინება წარმატებით გაიგზავნა!', 'success')
        return redirect(url_for('main.contact'))
    
    return render_template('contact.html')

@main.route('/booking', methods=['GET', 'POST'])
def booking():
    """დაჯავშნის გვერდი"""
    if request.method == 'POST':
        try:
            # ფორმის მონაცემების მიღება
            service_id = request.form.get('service_id')
            barber_id = request.form.get('barber_id')
            date_str = request.form.get('date')
            time_str = request.form.get('time')
            name = request.form.get('name')
            phone = request.form.get('phone')
            email = request.form.get('email')
            notes = request.form.get('notes')
            
            # თარიღისა და დროის კონვერტაცია
            booking_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            booking_time = datetime.strptime(time_str, '%H:%M').time()
            
            # ახალი დაჯავშნის შექმნა
            new_booking = Booking(
                service_id=service_id,
                barber_id=barber_id if barber_id != 'any' else None,
                date=booking_date,
                time=booking_time,
                customer_name=name,
                customer_phone=phone,
                customer_email=email,
                notes=notes,
                status='pending'
            )
            
            db.session.add(new_booking)
            db.session.commit()
            
            # TODO: ელ.ფოსტის გაგზავნა
            
            flash('დაჯავშნა წარმატებით შესრულდა!', 'success')
            return redirect(url_for('main.booking_success', booking_id=new_booking.id))
            
        except Exception as e:
            db.session.rollback()
            flash(f'შეცდომა დაჯავშნის დროს: {str(e)}', 'error')
            return redirect(url_for('main.booking'))
    
    # GET request - ფორმის ჩვენება
    services = Service.query.all()
    barbers = Barber.query.all()
    today = datetime.now().strftime('%Y-%m-%d')
    
    return render_template('booking.html', 
                         services=services, 
                         barbers=barbers,
                         today=today)

@main.route('/booking/success/<int:booking_id>')
def booking_success(booking_id):
    """დაჯავშნის წარმატების გვერდი"""
    booking = Booking.query.get_or_404(booking_id)
    return render_template('booking_success.html', booking=booking)

@main.route('/booking/cancel/<int:booking_id>')
def cancel_booking(booking_id):
    """დაჯავშნის გაუქმება"""
    try:
        booking = Booking.query.get_or_404(booking_id)
        booking.status = 'cancelled'
        db.session.commit()
        
        flash('დაჯავშნა წარმატებით გაუქმდა.', 'success')
        return redirect(url_for('main.index'))
    except Exception as e:
        db.session.rollback()
        flash(f'შეცდომა: {str(e)}', 'error')
        return redirect(url_for('main.index'))