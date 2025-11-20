from app import db
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin

class Service(db.Model):
    """სერვისების მოდელი"""
    __tablename__ = 'services'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50))
    icon = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    bookings = db.relationship('Booking', backref='service', lazy=True)
    
    def __repr__(self):
        return f'<Service {self.name}>'


class Barber(db.Model):
    """ბარბერების მოდელი"""
    __tablename__ = 'barbers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    position = db.Column(db.String(100))
    bio = db.Column(db.Text)
    specialties = db.Column(db.String(500))
    experience_years = db.Column(db.Integer)
    rating = db.Column(db.Float, default=5.0)
    image_url = db.Column(db.String(500))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    is_available = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    vacation_start = db.Column(db.Date, nullable=True)
    vacation_end = db.Column(db.Date, nullable=True)
    # Link to User
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    bookings = db.relationship('Booking', backref='barber', lazy=True)
    
    def __repr__(self):
        return f'<Barber {self.name}>'


class Client(db.Model):
    """კლიენტების ბაზა (CRM)"""
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    # ტელეფონი არის უნიკალური იდენტიფიკატორი
    phone = db.Column(db.String(20), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120))
    
    # ადმინისთვის: შენიშვნები და დაბლოკვა
    notes = db.Column(db.Text) 
    is_blocked = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ურთიერთკავშირი ჯავშნებთან
    bookings = db.relationship('Booking', backref='client_profile', lazy=True)

    def __repr__(self):
        return f'<Client {self.name} - {self.phone}>'

class Booking(db.Model):
    """დაჯავშნების მოდელი - განახლებული"""
    __tablename__ = 'bookings'
    
    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey('services.id'), nullable=False)
    barber_id = db.Column(db.Integer, db.ForeignKey('barbers.id'), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)
    price = db.Column(db.Float, nullable=False, default=0.0) 
    start_time = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='pending')
    
    # კლიენტის ინფორმაცია
    customer_name = db.Column(db.String(100), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    customer_email = db.Column(db.String(120))
    notes = db.Column(db.Text)
    
    # Alias fields (Admin panel-თან თავსებადობისთვის)
    client_name = db.Column(db.String(100))
    client_phone = db.Column(db.String(20))
    client_email = db.Column(db.String(120))
    
    confirmation_code = db.Column(db.String(20), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # ✅ Backward Compatibility: რომ კოდის სხვა ნაწილები არ გატყდეს
    @property
    def date(self):
        return self.start_time.date() if self.start_time else None

    @property
    def time(self):
        return self.start_time.time() if self.start_time else None

    def __repr__(self):
        return f'<Booking {self.id} - {self.customer_name}>'
    
    def generate_confirmation_code(self):
        import random
        import string
        code = 'MAD-' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        self.confirmation_code = code
        return code


class User(UserMixin, db.Model):
    """ადმინ/ბარბერ/რეცეფციის მოდელი"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    
    # ახალი ველები
    first_name = db.Column(db.String(50))
    last_name = db.Column(db.String(50))
    phone = db.Column(db.String(20))
    specialization = db.Column(db.Text)  # ბარბერებისთვის
    
    role = db.Column(db.String(20), default='receptionist')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    barber = db.relationship('Barber', backref='user', uselist=False)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def get_full_name(self):
        """სრული სახელი"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username
    
    def is_admin(self):
        return self.role == 'admin'
    
    def is_barber(self):
        return self.role == 'barber'
    
    def is_reception(self):
        return self.role == 'receptionist' or self.role == 'reception'
    
    def is_receptionist(self):
        return self.is_reception()
    
    def __repr__(self):
        return f'<User {self.username}>'


class BarberSchedule(db.Model):
    """ბარბერის სტანდარტული სამუშაო გრაფიკი (კვირის მიხედვით)"""
    __tablename__ = 'barber_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    barber_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=ორშაბათი, 1=სამშაბათი... 6=კვირა
    start_time = db.Column(db.Time, nullable=False)  # მაგ: 10:00
    end_time = db.Column(db.Time, nullable=False)  # მაგ: 19:00
    is_working = db.Column(db.Boolean, default=True)  # მუშაობს თუ არა ამ დღეს
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationship
    barber = db.relationship('User', backref='work_schedule', foreign_keys=[barber_id])
    
    def __repr__(self):
        return f'<BarberSchedule {self.barber_id} - Day {self.day_of_week}: {self.start_time}-{self.end_time}>'
    
    @staticmethod
    def get_day_name(day_num):
        """დღის ნომრიდან სახელის მიღება"""
        days = {
            0: 'ორშაბათი',
            1: 'სამშაბათი', 
            2: 'ოთხშაბათი',
            3: 'ხუთშაბათი',
            4: 'პარასკევი',
            5: 'შაბათი',
            6: 'კვირა'
        }
        return days.get(day_num, 'უცნობი')


# BarberAvailability - ძველი მოდელი (deprecated, ახლა BarberSchedule გამოიყენება)
class BarberAvailability(db.Model):
    """ბარბერის ხელმისაწვდომობის განრიგი (deprecated)"""
    __tablename__ = 'barber_availability'
    
    id = db.Column(db.Integer, primary_key=True)
    barber_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=ორშაბათი, 6=კვირა
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_available = db.Column(db.Boolean, default=True)
    
    def __repr__(self):
        return f'<BarberAvailability {self.barber_id} - Day {self.day_of_week}>'