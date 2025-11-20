# app/routes/main.py

from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from app.models import Booking, Service, Barber, User
from app import db
from datetime import datetime
import os

main = Blueprint('main', __name__)

@main.route('/')
def index():
    """მთავარი გვერდი დინამიური მონაცემებით"""
    try:
        # სერვისები (ლიმიტი 3)
        services = Service.query.filter_by(is_active=True).limit(3).all()
        
        # ბარბერები (ლიმიტი 4)
        barbers = Barber.query.join(User).filter(User.is_active==True).limit(4).all()
        
        return render_template('index.html', services=services, barbers=barbers)
    except Exception as e:
        print(f"Error loading index: {e}")
        return render_template('index.html', services=[], barbers=[])

@main.route('/services')
def services():
    """სერვისების სრული სია"""
    try:
        services = Service.query.filter_by(is_active=True).all()
        return render_template('services.html', services=services)
    except Exception:
        return render_template('services.html', services=[])

@main.route('/barbers')
def barbers():
    """ბარბერების სრული სია და სტატისტიკა"""
    try:
        # ყველა აქტიური ბარბერი
        barbers = Barber.query.join(User).filter(User.is_active==True).all()
        
        # ✅ სტატისტიკის გამოთვლა (აუცილებელია შაბლონისთვის)
        total_experience = sum([b.experience_years or 0 for b in barbers])
        total_bookings = Booking.query.count()
        
        stats = {
            'count': len(barbers),
            'experience': total_experience,
            'clients': total_bookings + 150  # მარკეტინგული "ბუსტი" :)
        }
        
        return render_template('barbers.html', barbers=barbers, stats=stats)
    except Exception as e:
        print(f"Error loading barbers: {e}")
        # ✅ ერორის შემთხვევაშიც ვაწვდით ცარიელ stats-ს, რომ არ გაიქრაშოს
        empty_stats = {'count': 0, 'experience': 0, 'clients': 0}
        return render_template('barbers.html', barbers=[], stats=empty_stats)

@main.route('/gallery')
def gallery():
    return render_template('gallery.html')

@main.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        # აქ მომავალში მეილის გაგზავნა ჩაჯდება
        flash('თქვენი შეტყობინება წარმატებით გაიგზავნა!', 'success')
        return redirect(url_for('main.contact'))
    return render_template('contact.html')

@main.route('/booking', methods=['GET', 'POST'])
def booking():
    # Booking გვერდი მონაცემებს API-დან იღებს (JS-ით)
    return render_template('booking.html')

@main.route('/booking/success/<int:booking_id>')
def booking_success(booking_id):
    booking = Booking.query.get_or_404(booking_id)
    return render_template('booking_success.html', booking=booking)

@main.route('/apple-touch-icon.png')
def mobile_icon():
    from flask import send_from_directory
    return send_from_directory(
        os.path.join(current_app.root_path, 'static', 'images'),
        'madmen-logo.png', 
        mimetype='image/png'
    )