from flask_wtf import FlaskForm
from wtforms import StringField, SelectField, DateField, TimeField, TextAreaField, HiddenField
from wtforms.validators import DataRequired, Email, Optional, Length


class BookingForm(FlaskForm):
    """ჯავშნის შექმნის/რედაქტირების ფორმა"""
    
    # Client Information
    client_name = StringField(
        'კლიენტის სახელი',
        validators=[
            DataRequired(message='სახელი სავალდებულოა'),
            Length(min=2, max=100, message='სახელი უნდა იყოს 2-100 სიმბოლო')
        ]
    )
    
    client_phone = StringField(
        'ტელეფონი',
        validators=[
            DataRequired(message='ტელეფონი სავალდებულოა'),
            Length(min=9, max=20, message='შეიყვანეთ სწორი ტელეფონის ნომერი')
        ]
    )
    
    client_email = StringField(
        'ელ. ფოსტა',
        validators=[
            Optional(),
            Email(message='შეიყვანეთ სწორი ელ.ფოსტა')
        ]
    )
    
    # Booking Details
    service_id = SelectField(
        'სერვისი',
        coerce=int,
        validators=[DataRequired(message='აირჩიეთ სერვისი')]
    )
    
    barber_id = SelectField(
        'ბარბერი',
        coerce=int,
        validators=[DataRequired(message='აირჩიეთ ბარბერი')]
    )
    
    booking_date = DateField(
        'თარიღი',
        format='%Y-%m-%d',
        validators=[DataRequired(message='აირჩიეთ თარიღი')]
    )
    
    booking_time = TimeField(
        'დრო',
        format='%H:%M',
        validators=[DataRequired(message='აირჩიეთ დრო')]
    )
    
    # Optional fields
    notes = TextAreaField(
        'შენიშვნები',
        validators=[Optional(), Length(max=500)]
    )
    
    status = SelectField(
        'სტატუსი',
        choices=[
            ('pending', 'მოლოდინში'),
            ('confirmed', 'დადასტურებული'),
            ('completed', 'დასრულებული'),
            ('cancelled', 'გაუქმებული')
        ],
        default='pending'
    )
    
    def __init__(self, *args, **kwargs):
        super(BookingForm, self).__init__(*args, **kwargs)
        
        # Populate service choices
        from app.models import Service, User
        
        services = Service.query.filter_by(is_active=True).all()
        self.service_id.choices = [(0, 'აირჩიეთ სერვისი...')] + [
            (s.id, f'{s.name} - {s.price}₾ ({s.duration}წთ)') 
            for s in services
        ]
        
        # Populate barber choices
        barbers = User.query.filter_by(role='barber', is_active=True).all()
        self.barber_id.choices = [(0, 'აირჩიეთ ბარბერი...')] + [
            (b.id, b.get_full_name()) 
            for b in barbers
        ]