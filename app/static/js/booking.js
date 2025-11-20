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

document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    loadBarbers();
    initializeCalendar();
    setupEventListeners();
});

// Haptic Feedback Helper
function triggerHaptic() {
    if (navigator.vibrate) navigator.vibrate(10);
}

function setupEventListeners() {
    // Navigation
    document.getElementById('nextToServices').addEventListener('click', () => { if(validateStep1()) goToStep(2); });
    document.getElementById('nextToDateTime').addEventListener('click', () => goToStep(4));
    document.getElementById('nextToConfirmation').addEventListener('click', () => { collectCustomerInfo(); goToStep(5); });
    document.getElementById('confirmBooking').addEventListener('click', submitBooking);
    
    // Calendar Nav
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
    // Phone Input Logic
    let typingTimer;
    document.getElementById('customerPhone').addEventListener('input', function() {
        clearTimeout(typingTimer);
        const phone = this.value.replace(/\D/g,'');
        if(phone.length >= 9) typingTimer = setTimeout(() => checkUserPhone(phone), 800);
    });
}

// Client Lookup
async function checkUserPhone(phone) {
    const skeleton = document.getElementById('skeletonLoader');
    const extraFields = document.getElementById('extraFields');
    const banner = document.getElementById('welcomeBackBanner');
    
    skeleton.classList.remove('hidden');
    extraFields.classList.add('hidden');
    banner.classList.add('hidden');

    try {
        const response = await fetch('/api/clients/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phone })
        });
        const data = await response.json();

        if (data.found) {
            document.getElementById('customerName').value = data.name;
            document.getElementById('customerEmail').value = data.email || '';
            
            if (data.is_blocked) {
                alert("თქვენ შეზღუდული გაქვთ ჯავშნის უფლება.");
                location.reload();
                return;
            }
            if (data.last_visit) {
                document.getElementById('wbName').textContent = data.name;
                document.getElementById('wbDate').textContent = data.last_visit.date;
                document.getElementById('wbBarber').textContent = data.last_visit.barber;
                banner.classList.remove('hidden');
            }
        }
    } catch (error) { console.error(error); } 
    finally {
        skeleton.classList.add('hidden');
        extraFields.classList.remove('hidden', 'opacity-30', 'pointer-events-none', 'grayscale');
        extraFields.classList.add('animate-fade-in');
    }
}

function validateStep1() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    if(name.length < 2 || phone.length < 9) { alert('შეავსეთ სახელი და ტელეფონი'); return false; }
    bookingState.customerInfo = { name: name, phone: phone, email: document.getElementById('customerEmail').value };
    return true;
}

function goToStep(step) {
    triggerHaptic();
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.progress-step').forEach(el => el.classList.remove('active', 'completed'));
    
    document.getElementById(`step${step}`).classList.add('active');
    document.querySelectorAll('.progress-step').forEach((el, index) => {
        const stepNum = index + 1;
        if (stepNum < step) el.classList.add('completed');
        else if (stepNum === step) el.classList.add('active');
    });
    
    bookingState.currentStep = step;
    
    // თუ კალენდარზე გადავედით, გადავარენდეროთ რომ სქროლი ამუშავდეს
    if (step === 4) {
        setTimeout(renderCalendar, 50); 
    }
    if (step === 5) renderConfirmationSummary();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadServices() {
    try { const res = await fetch('/api/services'); const data = await res.json(); if (data.success) renderServices(data.services); } catch (e) {}
}
function renderServices(services) {
    document.getElementById('servicesGrid').innerHTML = services.map(s => `
        <div class="service-card p-6 rounded-xl border-2 border-gray-800 hover:border-yellow-600 bg-[#1a1a1a] cursor-pointer transition-all" data-service-id="${s.id}" onclick="selectService(${s.id})">
            <h3 class="text-white font-bold text-lg mb-1">${s.name}</h3>
            <div class="flex justify-between text-sm text-gray-400 mt-4 pt-4 border-t border-gray-700">
                <span class="text-yellow-500 font-bold text-lg">${s.price}₾</span>
                <span>${s.duration} წთ</span>
            </div>
        </div>`).join('');
}
function selectService(id) {
    triggerHaptic();
    document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
    document.querySelector(`[data-service-id="${id}"]`).classList.add('selected');
    bookingState.selectedService = id;
    bookingState.selectedBarber = null; bookingState.selectedDate = null; bookingState.selectedTime = null;
    
    // Auto advance logic removed per request, waiting for user to click next or rely on design flow. 
    // But for flow:
    setTimeout(() => goToStep(3), 300);
}

async function loadBarbers() {
    try { const res = await fetch('/api/barbers'); const data = await res.json(); if (data.success) renderBarbers(data.barbers); } catch (e) {}
}
function renderBarbers(barbers) {
    document.getElementById('barbersGrid').innerHTML = barbers.map(b => {
        const img = b.image ? `<img src="${b.image}" class="w-full h-full object-cover pointer-events-none">` : `<span class="text-2xl font-bold text-gray-300 pointer-events-none">${b.name[0]}</span>`;
        return `
        <div class="barber-card p-4 rounded-xl border-2 border-gray-800 hover:border-yellow-600 bg-[#1a1a1a] cursor-pointer flex flex-col items-center gap-3 transition-all" data-barber-id="${b.id}" onclick="selectBarber(${b.id})">
            <div class="barber-avatar w-20 h-20 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center border-2 border-gray-600 pointer-events-none relative">
                ${img}
                <div class="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#1a1a1a] rounded-full z-10"></div>
            </div>
            <h3 class="text-white font-bold pointer-events-none text-center">${b.name}</h3>
        </div>`;
    }).join('');
}
function selectBarber(id) {
    triggerHaptic();
    document.querySelectorAll('.barber-card').forEach(el => el.classList.remove('selected'));
    document.querySelector(`[data-barber-id="${id}"]`).classList.add('selected');
    bookingState.selectedBarber = id;
    
    const btn = document.getElementById('nextToDateTime');
    if(btn) {
        btn.disabled = false;
        btn.classList.remove('cursor-not-allowed', 'bg-gray-700', 'text-gray-400');
        btn.classList.add('bg-gradient-to-r', 'from-[#B07D4A]', 'to-[#C724B1]', 'text-white');
    }
}

// Calendar Functions
function initializeCalendar() {
    const today = new Date();
    bookingState.currentMonth = today.getMonth();
    bookingState.currentYear = today.getFullYear();
}

function changeMonth(delta) {
    bookingState.currentMonth += delta;
    if (bookingState.currentMonth < 0) { bookingState.currentMonth = 11; bookingState.currentYear--; }
    else if (bookingState.currentMonth > 11) { bookingState.currentMonth = 0; bookingState.currentYear++; }
    renderCalendar();
}

// ✅ განახლებული: Render Calendar + Auto Scroll
function renderCalendar() {
    const months = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
    const weekdays = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
    document.getElementById('calendarTitle').textContent = `${months[bookingState.currentMonth]} ${bookingState.currentYear}`;
    
    const firstDay = new Date(bookingState.currentYear, bookingState.currentMonth, 1);
    const lastDay = new Date(bookingState.currentYear, bookingState.currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let html = '';
    for (let i = 0; i < startingDay; i++) html += '<div class="calendar-day other-month hidden md:flex"></div>';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(bookingState.currentYear, bookingState.currentMonth, day);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        const dayName = weekdays[date.getDay()];
        const isToday = date.getTime() === today.getTime();
        const isPast = date < today;
        const isSelected = dateStr === bookingState.selectedDate;
        
        let classes = 'calendar-day aspect-square flex flex-col items-center justify-center bg-[#2a2a2a] border border-[#333] rounded-lg cursor-pointer text-sm transition-all min-w-[70px] md:min-w-0 snap-center';
        if (isToday) classes += ' border-[#B07D4A] text-[#B07D4A] font-bold today'; // დავამატეთ .today კლასი
        if (isPast) classes += ' opacity-30 cursor-not-allowed pointer-events-none';
        if (isSelected) classes += ' selected';
        
        const onclick = isPast ? '' : `onclick="selectDate('${dateStr}')"`;
        html += `<div class="${classes}" ${onclick}>
            <span class="text-[10px] uppercase text-gray-500 mb-1 md:hidden font-bold ${isSelected ? 'text-white/80' : ''}">${dayName}</span>
            <span class="text-lg">${day}</span>
        </div>`;
    }
    
    const container = document.getElementById('calendarDays');
    container.innerHTML = html;

    // ✅ AUTO-SCROLL LOGIC (მობილურისთვის)
    setTimeout(() => {
        // ვეძებთ არჩეულ დღეს ან დღევანდელ დღეს
        const target = container.querySelector('.selected') || container.querySelector('.today');
        
        if (target && container.scrollWidth > container.clientWidth) {
            // ვითვლით ცენტრალურ პოზიციას
            const scrollPos = target.offsetLeft - (container.offsetWidth / 2) + (target.offsetWidth / 2);
            
            container.scrollTo({
                left: scrollPos,
                behavior: 'smooth'
            });
        }
    }, 100);
}

async function selectDate(dateStr) {
    triggerHaptic();
    bookingState.selectedDate = dateStr;
    bookingState.selectedTime = null;
    renderCalendar();
    await loadTimeSlots();
}

async function loadTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    container.style.display = 'block';
    container.classList.remove('hidden');
    document.getElementById('morningSlots').innerHTML = '<div class="text-gray-500 text-sm animate-pulse">იტვირთება...</div>';
    document.getElementById('afternoonSlots').innerHTML = '';
    document.getElementById('eveningSlots').innerHTML = '';
    
    try {
        const res = await fetch(`/api/available-slots/${bookingState.selectedBarber}/${bookingState.selectedDate}?service_id=${bookingState.selectedService}`);
        const data = await res.json();
        if (data.success && data.is_working) renderTimeSlots(data.slots);
        else showNoSlotsMessage(data.message || 'ბარბერი არ მუშაობს');
    } catch (e) { console.error(e); showNoSlotsMessage('შეცდომა'); }
}

function renderTimeSlots(slots) {
    const sections = ['morning', 'afternoon', 'evening'];
    let hasSlots = false;
    sections.forEach(sec => {
        const div = document.getElementById(`${sec}Section`);
        const grid = document.getElementById(`${sec}Slots`);
        if (slots[sec] && slots[sec].length > 0) {
            hasSlots = true;
            div.style.display = 'block';
            grid.innerHTML = slots[sec].map(t => `<div class="time-slot bg-[#2a2a2a] border border-[#333] rounded-lg py-3 text-center text-sm font-medium cursor-pointer hover:border-[#B07D4A] transition-all" onclick="selectTime('${t}')">${t}</div>`).join('');
        } else { div.style.display = 'none'; }
    });
    if (!hasSlots) showNoSlotsMessage('თავისუფალი დრო არ არის');
}

function showNoSlotsMessage(msg) {
    ['morning', 'afternoon', 'evening'].forEach(s => document.getElementById(`${s}Section`).style.display = 'none');
    document.getElementById('morningSection').style.display = 'block';
    document.getElementById('morningSlots').innerHTML = `<div class="text-gray-400 text-sm col-span-3 text-center py-4 border border-dashed border-gray-700 rounded-lg">${msg}</div>`;
}

function selectTime(time) {
    triggerHaptic();
    document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
    event.target.classList.add('selected');
    bookingState.selectedTime = time;
    const btn = document.getElementById('nextToConfirmation');
    btn.disabled = false;
    btn.classList.remove('cursor-not-allowed', 'bg-gray-700');
    btn.classList.add('bg-gradient-to-r', 'from-[#B07D4A]', 'to-[#C724B1]', 'text-white');
}

function collectCustomerInfo() {
    bookingState.customerInfo.notes = document.getElementById('customerNotes').value;
}

function renderConfirmationSummary() {
    const sName = document.querySelector(`[data-service-id="${bookingState.selectedService}"] h3`).textContent;
    const sPrice = document.querySelector(`[data-service-id="${bookingState.selectedService}"] .text-yellow-500`).textContent;
    const bName = document.querySelector(`[data-barber-id="${bookingState.selectedBarber}"] h3`).textContent;
    
    document.getElementById('confirmationSummary').innerHTML = `
        <div class="flex justify-between py-3 border-b border-[#333]"><span class="text-gray-500 text-sm font-bold uppercase">სერვისი</span><span class="text-white">${sName}</span></div>
        <div class="flex justify-between py-3 border-b border-[#333]"><span class="text-gray-500 text-sm font-bold uppercase">ბარბერი</span><span class="text-white">${bName}</span></div>
        <div class="flex justify-between py-3 border-b border-[#333]"><span class="text-gray-500 text-sm font-bold uppercase">თარიღი</span><span class="text-white">${bookingState.selectedDate}</span></div>
        <div class="flex justify-between py-3 border-b border-[#333]"><span class="text-gray-500 text-sm font-bold uppercase">დრო</span><span class="text-white font-mono">${bookingState.selectedTime}</span></div>
        <div class="flex justify-between py-4 mt-2"><span class="text-gray-400 font-bold text-lg">სულ გადასახდელი</span><span class="text-[#B07D4A] font-bold text-2xl">${sPrice}</span></div>
    `;
}

async function submitBooking() {
    const btn = document.getElementById('confirmBooking');
    btn.disabled = true; btn.textContent = 'იტვირთება...';
    try {
        const res = await fetch('/api/bookings/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const data = await res.json();
        if(data.success) window.location.href = `/booking/success/${data.booking_id}`;
        else { alert(data.error); btn.disabled=false; btn.textContent='დადასტურება ✓'; }
    } catch (e) { console.error(e); alert('შეცდომა'); btn.disabled=false; btn.textContent='დადასტურება ✓'; }
}