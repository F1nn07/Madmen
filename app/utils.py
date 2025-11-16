from flask import render_template, current_app, url_for
from flask_mail import Message
from app import mail
from threading import Thread


def send_async_email(app, msg):
    """ასინქრონული email გაგზავნა"""
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            current_app.logger.error(f'Email sending failed: {str(e)}')


def send_email(subject, recipients, text_body, html_body):
    """Email გაგზავნის ფუნქცია"""
    msg = Message(subject, recipients=recipients)
    msg.body = text_body
    msg.html = html_body
    
    Thread(target=send_async_email, args=(current_app._get_current_object(), msg)).start()


def send_booking_confirmation_email(booking):
    """ჯავშნის დადასტურების email"""
    if not booking.client_email:
        return
    
    subject = f'ჯავშნის დადასტურება - MAD-MEN #{booking.id}'
    
    # Text version
    text_body = f'''
გამარჯობა {booking.client_name},

თქვენი ჯავშანი წარმატებით შეიქმნა!

ჯავშნის დეტალები:
━━━━━━━━━━━━━━━━━━━━
ჯავშნის ნომერი: #{booking.id}
მომსახურება: {booking.service.name}
ბარბერი: {booking.barber.get_full_name()}
თარიღი: {booking.start_time.strftime('%d/%m/%Y')}
დრო: {booking.start_time.strftime('%H:%M')} - {booking.end_time.strftime('%H:%M')}
ფასი: {booking.service.price}₾
━━━━━━━━━━━━━━━━━━━━

გთხოვთ მობრძანდეთ დროულად!

MAD-MEN Barbershop
📞 +995 555 123 456
📧 info@madmen.ge
'''
    
    # HTML version with logo URL context
    html_body = render_template(
        'emails/booking_confirmation.html', 
        booking=booking,
        logo_url=url_for('static', filename='images/madmen-logo.png', _external=True)
    )
    
    send_email(subject, [booking.client_email], text_body, html_body)