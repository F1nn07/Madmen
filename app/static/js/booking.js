// Booking State
const bookingState = {
    currentStep: 1,
    selectedService: null,
    selectedBarber: null,
    selectedDate: null,
    selectedTime: null,
    customerInfo: {},
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    loadBarbers();
    initializeCalendar();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    document.getElementById('nextToBarber').addEventListener('click', () => goToStep(2));
    document.getElementById('nextToDateTime').addEventListener('click', () => goToStep(3));
    document.getElementById('nextToContact').addEventListener('click', () => goToStep(4));
    document.getElementById('nextToConfirmation').addEventListener('click', () => {
        if (validateContactForm()) {
            collectCustomerInfo();
            goToStep(5);
        }
    });
    document.getElementById('confirmBooking').addEventListener('click', submitBooking);
    
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
    // Real-time validation
    document.getElementById('customerName').addEventListener('input', function() {
        this.style.border = '';
        if (this.value.trim().length >= 2) {
            this.style.border = '1px solid #10b981';
        }
    });
    
    document.getElementById('customerPhone').addEventListener('input', function() {
        this.style.border = '';
        const cleaned = this.value.replace(/[\s-]/g, '');
        if (cleaned.length >= 9 && /^[0-9]+$/.test(cleaned)) {
            this.style.border = '1px solid #10b981';
        }
    });
    
    document.getElementById('customerEmail').addEventListener('input', function() {
        this.style.border = '';
        if (this.value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) {
            this.style.border = '1px solid #10b981';
        }
    });
}

// Step Navigation
function goToStep(step) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach(el => {
        el.classList.remove('active', 'completed');
    });
    
    // Show current step
    document.getElementById(`step${step}`).classList.add('active');
    
    // Update progress
    document.querySelectorAll('.progress-step').forEach((el, index) => {
        const stepNum = index + 1;
        if (stepNum < step) {
            el.classList.add('completed');
        } else if (stepNum === step) {
            el.classList.add('active');
        }
    });
    
    bookingState.currentStep = step;
    
    // Special actions for certain steps
    if (step === 3) {
        renderCalendar();
    } else if (step === 5) {
        renderConfirmationSummary();
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load Services
async function loadServices() {
    try {
        const response = await fetch('/api/services');
        const data = await response.json();
        
        if (data.success) {
            renderServices(data.services);
        }
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

function renderServices(services) {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = services.map(service => `
        <div class="service-card" data-service-id="${service.id}" onclick="selectService(${service.id})">
            <div class="service-icon">✂️</div>
            <h3 class="service-name">${service.name}</h3>
            <p class="service-description">${service.description || ''}</p>
            <div class="service-details">
                <span class="service-price">${service.price}₾</span>
                <span class="service-duration">${service.duration} წთ</span>
            </div>
        </div>
    `).join('');
}

function selectService(serviceId) {
    // Remove previous selection
    document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
    
    // Select new service
    const card = document.querySelector(`[data-service-id="${serviceId}"]`);
    card.classList.add('selected');
    
    // Save to state
    bookingState.selectedService = serviceId;
    
    // Enable next button
    document.getElementById('nextToBarber').disabled = false;
}

// Load Barbers
async function loadBarbers() {
    try {
        const response = await fetch('/api/barbers');
        const data = await response.json();
        
        if (data.success) {
            renderBarbers(data.barbers);
        }
    } catch (error) {
        console.error('Error loading barbers:', error);
    }
}

function renderBarbers(barbers) {
    const grid = document.getElementById('barbersGrid');
    grid.innerHTML = barbers.map(barber => `
        <div class="barber-card" data-barber-id="${barber.id}" onclick="selectBarber(${barber.id})">
            <div class="barber-avatar">${barber.name.charAt(0)}</div>
            <h3 class="barber-name">${barber.name}</h3>
            <p class="barber-specialty">${barber.specialization || ''}</p>
        </div>
    `).join('');
}

function selectBarber(barberId) {
    // Remove previous selection
    document.querySelectorAll('.barber-card').forEach(el => el.classList.remove('selected'));
    
    // Select new barber
    const card = document.querySelector(`[data-barber-id="${barberId}"]`);
    card.classList.add('selected');
    
    // Save to state
    bookingState.selectedBarber = barberId;
    
    // Enable next button
    document.getElementById('nextToDateTime').disabled = false;
}

// Calendar Functions
function initializeCalendar() {
    const today = new Date();
    bookingState.currentMonth = today.getMonth();
    bookingState.currentYear = today.getFullYear();
}

function changeMonth(delta) {
    bookingState.currentMonth += delta;
    
    if (bookingState.currentMonth < 0) {
        bookingState.currentMonth = 11;
        bookingState.currentYear--;
    } else if (bookingState.currentMonth > 11) {
        bookingState.currentMonth = 0;
        bookingState.currentYear++;
    }
    
    renderCalendar();
}

function renderCalendar() {
    const months = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 
                   'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
    
    // Update title
    document.getElementById('calendarTitle').textContent = 
        `${months[bookingState.currentMonth]} ${bookingState.currentYear}`;
    
    // Get first day of month and number of days
    const firstDay = new Date(bookingState.currentYear, bookingState.currentMonth, 1);
    const lastDay = new Date(bookingState.currentYear, bookingState.currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Adjust for Monday start
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    
    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day other-month"></div>';
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(bookingState.currentYear, bookingState.currentMonth, day);
        const dateStr = formatDate(date);
        const isToday = date.getTime() === today.getTime();
        const isPast = date < today;
        const isSelected = dateStr === bookingState.selectedDate;
        
        let classes = 'calendar-day';
        if (isToday) classes += ' today';
        if (isPast) classes += ' disabled';
        if (isSelected) classes += ' selected';
        
        const onclick = isPast ? '' : `onclick="selectDate('${dateStr}')"`;
        
        html += `<div class="${classes}" ${onclick}>${day}</div>`;
    }
    
    document.getElementById('calendarDays').innerHTML = html;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

async function selectDate(dateStr) {
    // Update selection
    bookingState.selectedDate = dateStr;
    bookingState.selectedTime = null;
    
    // Update calendar UI
    document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // Load available slots
    await loadTimeSlots();
}

async function loadTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    container.style.display = 'block';
    
    // Show loading
    document.getElementById('morningSlots').innerHTML = '<div class="loading-message">იტვირთება...</div>';
    document.getElementById('afternoonSlots').innerHTML = '';
    document.getElementById('eveningSlots').innerHTML = '';
    
    try {
        const url = `/api/available-slots/${bookingState.selectedBarber}/${bookingState.selectedDate}?service_id=${bookingState.selectedService}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success && data.is_working) {
            renderTimeSlots(data.slots);
        } else {
            showNoSlotsMessage(data.message || 'ბარბერი არ მუშაობს ამ დღეს');
        }
    } catch (error) {
        console.error('Error loading time slots:', error);
        showNoSlotsMessage('შეცდომა დროის ჩატვირთვისას');
    }
}

function renderTimeSlots(slots) {
    const sections = ['morning', 'afternoon', 'evening'];
    
    sections.forEach(section => {
        const sectionEl = document.getElementById(`${section}Section`);
        const slotsEl = document.getElementById(`${section}Slots`);
        
        if (slots[section] && slots[section].length > 0) {
            sectionEl.style.display = 'block';
            slotsEl.innerHTML = slots[section].map(time => `
                <div class="time-slot" onclick="selectTime('${time}')">
                    ${time}
                </div>
            `).join('');
        } else {
            sectionEl.style.display = 'none';
        }
    });
    
    // Check if any slots available
    const totalSlots = (slots.morning?.length || 0) + 
                       (slots.afternoon?.length || 0) + 
                       (slots.evening?.length || 0);
    
    if (totalSlots === 0) {
        showNoSlotsMessage('ამ თარიღზე თავისუფალი დრო არ არის');
    }
}

function showNoSlotsMessage(message) {
    document.getElementById('morningSection').style.display = 'none';
    document.getElementById('afternoonSection').style.display = 'none';
    document.getElementById('eveningSection').style.display = 'none';
    document.getElementById('morningSlots').innerHTML = `
        <div class="no-slots-message">${message}</div>
    `;
    document.getElementById('morningSection').style.display = 'block';
}

function selectTime(time) {
    // Remove previous selection
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    
    // Select new time
    event.target.classList.add('selected');
    
    // Save to state
    bookingState.selectedTime = time;
    
    // Enable next button
    document.getElementById('nextToContact').disabled = false;
}

// Customer Information
function validateContactForm() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    
    // Clear previous error styling
    document.getElementById('customerName').style.border = '';
    document.getElementById('customerPhone').style.border = '';
    document.getElementById('customerEmail').style.border = '';
    
    let isValid = true;
    let errors = [];
    
    // Validate name (must be at least 2 characters)
    if (!name || name.length < 2) {
        document.getElementById('customerName').style.border = '2px solid #ef4444';
        errors.push('• სახელი და გვარი სავალდებულოა (მინიმუმ 2 სიმბოლო)');
        isValid = false;
    }
    
    // Validate phone (must be 9-12 digits)
    const cleanedPhone = phone.replace(/[\s-]/g, '');
    if (!phone || cleanedPhone.length < 9 || cleanedPhone.length > 12) {
        document.getElementById('customerPhone').style.border = '2px solid #ef4444';
        errors.push('• ტელეფონის ნომერი სავალდებულოა (9-12 ციფრი)');
        isValid = false;
    } else if (!/^[0-9]+$/.test(cleanedPhone)) {
        document.getElementById('customerPhone').style.border = '2px solid #ef4444';
        errors.push('• ტელეფონი უნდა შეიცავდეს მხოლოდ ციფრებს');
        isValid = false;
    }
    
    // Validate email format (if provided)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        document.getElementById('customerEmail').style.border = '2px solid #ef4444';
        errors.push('• ელ. ფოსტის ფორმატი არასწორია');
        isValid = false;
    }
    
    if (!isValid) {
        // Show error message
        const errorMessage = 'გთხოვთ შეავსოთ ყველა სავალდებულო ველი:\n\n' + errors.join('\n');
        alert(errorMessage);
        
        // Focus on first invalid field
        if (!name || name.length < 2) {
            document.getElementById('customerName').focus();
        } else if (!phone || cleanedPhone.length < 9) {
            document.getElementById('customerPhone').focus();
        }
    }
    
    return isValid;
}

function collectCustomerInfo() {
    bookingState.customerInfo = {
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        email: document.getElementById('customerEmail').value,
        notes: document.getElementById('customerNotes').value
    };
}

// Confirmation Summary
function renderConfirmationSummary() {
    // Get selected data
    const serviceCard = document.querySelector(`[data-service-id="${bookingState.selectedService}"]`);
    const barberCard = document.querySelector(`[data-barber-id="${bookingState.selectedBarber}"]`);
    
    const serviceName = serviceCard.querySelector('.service-name').textContent;
    const servicePrice = serviceCard.querySelector('.service-price').textContent;
    const barberName = barberCard.querySelector('.barber-name').textContent;
    
    const summary = document.getElementById('confirmationSummary');
    summary.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">სერვისი</span>
            <span class="summary-value">${serviceName}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">ბარბერი</span>
            <span class="summary-value">${barberName}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">თარიღი</span>
            <span class="summary-value">${bookingState.selectedDate}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">დრო</span>
            <span class="summary-value">${bookingState.selectedTime}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">სახელი</span>
            <span class="summary-value">${bookingState.customerInfo.name}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">ტელეფონი</span>
            <span class="summary-value">${bookingState.customerInfo.phone}</span>
        </div>
        ${bookingState.customerInfo.email ? `
        <div class="summary-item">
            <span class="summary-label">ელ. ფოსტა</span>
            <span class="summary-value">${bookingState.customerInfo.email}</span>
        </div>
        ` : ''}
        <div class="summary-total">
            <span class="summary-total-label">სულ:</span>
            <span class="summary-total-value">${servicePrice}</span>
        </div>
    `;
}

// Submit Booking
async function submitBooking() {
    const btn = document.getElementById('confirmBooking');
    btn.disabled = true;
    btn.textContent = 'იტვირთება...';
    
    try {
        const response = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_id: bookingState.selectedService,
                barber_id: bookingState.selectedBarber,
                date: bookingState.selectedDate,
                time: bookingState.selectedTime,
                customer_name: bookingState.customerInfo.name,
                customer_phone: bookingState.customerInfo.phone,
                customer_email: bookingState.customerInfo.email,
                notes: bookingState.customerInfo.notes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Redirect to success page
            window.location.href = `/booking/success/${data.booking_id}`;
        } else {
            alert('შეცდომა: ' + data.error);
            btn.disabled = false;
            btn.textContent = 'დადასტურება ✓';
        }
    } catch (error) {
        console.error('Error submitting booking:', error);
        alert('შეცდომა ჯავშნის შექმნისას');
        btn.disabled = false;
        btn.textContent = 'დადასტურება ✓';
    }
}