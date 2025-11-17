// FullCalendar.js Integration for BarberFlow Admin Panel
// Complete Responsive Implementation (Mobile + Desktop)

// ⚠️ ADMIN PREFIX CONFIGURATION
const ADMIN_PREFIX = '/madmen-secure-admin-2024';

let calendar;
let currentBarberFilter = 'all';
let currentBookingId = null;

// 📱 RESPONSIVE DETECTION
const isMobile = () => window.innerWidth < 768;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    setupEventListeners();
    setupResponsiveHandler();
});

// ====================
// CALENDAR INITIALIZATION (RESPONSIVE)
// ====================
function initializeCalendar() {
    const calendarEl = document.getElementById('booking-calendar');
    const mobile = isMobile();
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        // 📱 RESPONSIVE INITIAL VIEW
        initialView: mobile ? 'timeGridDay' : 'timeGridWeek',
        
        // 📱 RESPONSIVE HEADER TOOLBAR
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: mobile 
                ? 'timeGridDay,dayGridMonth'  // Mobile: დღე, თვე
                : 'dayGridMonth,timeGridWeek,timeGridDay'  // Desktop: თვე, კვირა, დღე
        },
        
        // 📱 RESPONSIVE BUTTON TEXT
        buttonText: {
            today: 'დღეს',
            month: 'თვე',
            week: 'კვირა',
            day: 'დღე'
        },
        
        // Georgian locale
        locale: 'ka',
        firstDay: 1, // Monday
        
        // Time settings
        slotMinTime: '09:00:00',
        slotMaxTime: '21:00:00',
        slotDuration: '00:30:00',
        slotLabelInterval: '01:00',
        allDaySlot: false,
        
        // 📱 RESPONSIVE DISPLAY SETTINGS
        height: 'auto',
        expandRows: true,
        nowIndicator: true,
        
        // 🎯 MONTH VIEW OPTIMIZATION - Show only 2-3 events + "+X more"
        dayMaxEvents: mobile ? 2 : 3,
        moreLinkText: function(num) {
            return '+' + num + ' სხვა';
        },
        
        // 📱 RESPONSIVE VIEW SETTINGS
        views: {
            timeGridDay: {
                slotLabelFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }
            },
            timeGridWeek: {
                dayHeaderFormat: mobile 
                    ? { weekday: 'short', day: 'numeric' }
                    : { weekday: 'short', day: 'numeric', month: 'short' }
            }
        },
        
        // Time format
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        
        // Event source - fetch from API
        events: function(info, successCallback, failureCallback) {
            const url = buildEventsUrl(info.startStr, info.endStr);
            
            fetch(url)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('API request failed');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log('📅 Loaded events:', data.length);
                    successCallback(data);
                })
                .catch(error => {
                    console.error('❌ Error loading events:', error);
                    showNotification('შეცდომა ჯავშნების ჩატვირთვისას', 'error');
                    failureCallback(error);
                });
        },
        
        // ====================
        // INTERACTIONS
        // ====================
        
        // ინტერაქცია (1) - არსებულ ჯავშანზე დაკლიკება
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            showEventDetailsModal(info.event);
        },
        
        // ინტერაქცია (2) - ცარიელ ადგილზე დაკლიკება
        dateClick: function(info) {
            const view = calendar.view.type;
            
            if (view === 'timeGridWeek' || view === 'timeGridDay') {
                showCreateBookingModal(info.dateStr, info.date);
            } else if (view === 'dayGridMonth') {
                calendar.changeView('timeGridDay', info.dateStr);
            }
        },
        
        // 🎯 DRAG & DROP
        // Desktop: ყველგან ჩართულია
        // Mobile: მხოლოდ დღის ხედში
        editable: !mobile || calendar?.view?.type === 'timeGridDay',
        droppable: false,
        eventDurationEditable: !mobile || calendar?.view?.type === 'timeGridDay',
        
        // Drag & Drop callbacks
        eventDrop: function(info) {
            handleEventDrop(info);
        },
        
        eventResize: function(info) {
            handleEventResize(info);
        },
        
        // 📱 VIEW CHANGE HANDLER - Update drag/drop based on view
        viewDidMount: function(info) {
            const mobile = isMobile();
            const view = info.view.type;
            
            // Desktop: ყველა time view-ში editable
            // Mobile: მხოლოდ დღის ხედში editable
            const shouldBeEditable = mobile 
                ? (view === 'timeGridDay')  // მობილურზე მხოლოდ დღის ხედში
                : (view === 'timeGridWeek' || view === 'timeGridDay');  // დესკტოპზე კვირა და დღე
            
            calendar.setOption('editable', shouldBeEditable);
            calendar.setOption('eventDurationEditable', shouldBeEditable);
            
            console.log(`📱 View: ${view}, Mobile: ${mobile}, Editable: ${shouldBeEditable}`);
            
            // Update drag hint visibility
            updateDragHintVisibility(view, mobile);
        },
        
        // Event styling
        eventDidMount: function(info) {
            const status = info.event.extendedProps.status;
            const statusText = getStatusLabel(status);
            const barber = info.event.extendedProps.barberName || '';
            const customer = info.event.extendedProps.customerName || '';
            
            info.el.title = `${customer}\n${barber}\n${statusText}`;
        },
        
        // Loading indicator
        loading: function(isLoading) {
            const loader = document.getElementById('calendar-loader');
            if (loader) {
                loader.style.display = isLoading ? 'block' : 'none';
            }
        }
    });
    
    calendar.render();
}

// 📱 RESPONSIVE HANDLER - Reload calendar on screen resize
function setupResponsiveHandler() {
    let resizeTimer;
    let wasMobile = isMobile();
    
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            const isNowMobile = isMobile();
            
            if (wasMobile !== isNowMobile) {
                console.log('📱 Screen size changed, reloading calendar...');
                wasMobile = isNowMobile;
                
                if (calendar) {
                    calendar.destroy();
                }
                initializeCalendar();
                
                showNotification(
                    isNowMobile 
                        ? 'მობილურ რეჟიმზე გადავიდა' 
                        : 'დესკტოპ რეჟიმზე გადავიდა',
                    'info'
                );
            }
        }, 250);
    });
}

// Update drag hint visibility based on view and device
function updateDragHintVisibility(view, mobile) {
    const dragHint = document.getElementById('dragDropHint');
    if (!dragHint) return;
    
    // Show hint if:
    // - Desktop + time view OR
    // - Mobile + day view
    const shouldShow = mobile 
        ? (view === 'timeGridDay')
        : (view === 'timeGridWeek' || view === 'timeGridDay');
    
    dragHint.style.display = shouldShow ? 'flex' : 'none';
}

// Build API URL with filters
function buildEventsUrl(start, end) {
    let url = `/api/admin/all-bookings?start=${start}&end=${end}`;
    
    if (currentBarberFilter !== 'all') {
        url += `&barber_id=${currentBarberFilter}`;
    }
    
    return url;
}

// ====================
// EVENT LISTENERS
// ====================
function setupEventListeners() {
    // Barber filter
    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter) {
        barberFilter.addEventListener('change', function() {
            currentBarberFilter = this.value;
            calendar.refetchEvents();
        });
    }
    
    // Modal close
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAllModals();
            }
        });
    });
    
    // Escape key - close modals only (sidebar is handled globally)
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ====================
// MODAL: EVENT DETAILS (გამარტივებული - БЕЗ სტატუსის შეცვლის)
// ====================
function showEventDetailsModal(event) {
    currentBookingId = event.id;
    const props = event.extendedProps;
    
    // Format date and time
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    
    const dateStr = startDate.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });
    
    const timeStr = `${startDate.toLocaleTimeString('ka-GE', {
        hour: '2-digit',
        minute: '2-digit'
    })} - ${endDate.toLocaleTimeString('ka-GE', {
        hour: '2-digit',
        minute: '2-digit'
    })}`;
    
    const statusText = getStatusLabel(props.status);
    
    // Build modal content (БЕЗ status buttons)
    const modalBody = document.getElementById('detailsModalBody');
    modalBody.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">ჯავშნის ID:</span>
            <span class="detail-value">#${event.id}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">კლიენტი:</span>
            <span class="detail-value">${props.customerName}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">ტელეფონი:</span>
            <span class="detail-value">${props.customerPhone || 'N/A'}</span>
        </div>
        ${props.customerEmail ? `
        <div class="detail-row">
            <span class="detail-label">ელ. ფოსტა:</span>
            <span class="detail-value">${props.customerEmail}</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">სერვისი:</span>
            <span class="detail-value">${props.serviceName}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">ფასი:</span>
            <span class="detail-value">${props.servicePrice}₾</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">ხანგრძლივობა:</span>
            <span class="detail-value">${props.serviceDuration} წუთი</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">ბარბერი:</span>
            <span class="detail-value">${props.barberName}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">თარიღი:</span>
            <span class="detail-value">${dateStr}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">დრო:</span>
            <span class="detail-value">${timeStr}</span>
        </div>
        ${props.notes ? `
        <div class="detail-row">
            <span class="detail-label">შენიშვნები:</span>
            <span class="detail-value">${props.notes}</span>
        </div>
        ` : ''}
        <div class="detail-row">
            <span class="detail-label">სტატუსი:</span>
            <span class="detail-value status-badge status-${props.status}">${statusText}</span>
        </div>
        ${props.confirmationCode ? `
        <div class="detail-row">
            <span class="detail-label">დადასტურების კოდი:</span>
            <span class="detail-value">${props.confirmationCode}</span>
        </div>
        ` : ''}
        
        <div class="modal-actions">
            <button class="btn-modal btn-edit" onclick="editBooking(${event.id})">
                ✏️ რედაქტირება
            </button>
            <button class="btn-modal btn-delete" onclick="deleteBooking(${event.id})">
                🗑️ წაშლა
            </button>
            <button class="btn-modal" onclick="closeAllModals()">
                დახურვა
            </button>
        </div>
    `;
    
    document.getElementById('eventDetailsModal').classList.add('active');
}

// ====================
// MODAL: CREATE/EDIT BOOKING
// ====================
async function showCreateBookingModal(dateStr, dateObj) {
    const modalBody = document.getElementById('createModalBody');
    
    const date = dateStr.split('T')[0];
    const time = dateStr.split('T')[1]?.substring(0, 5) || '10:00';
    
    try {
        const response = await fetch(`${ADMIN_PREFIX}/bookings/new?date=${date}&time=${time}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load form');
        }
        
        const html = await response.text();
        modalBody.innerHTML = html;
        
        const form = document.getElementById('bookingForm');
        if (form) {
            form.onsubmit = handleCreateBooking;
        }
        
        document.getElementById('createBookingModal').classList.add('active');
    } catch (error) {
        console.error('Error loading create form:', error);
        showNotification('შეცდომა ფორმის ჩატვირთვისას', 'error');
    }
}

async function showEditBookingModal(bookingId) {
    const modalBody = document.getElementById('createModalBody');
    
    try {
        const response = await fetch(`${ADMIN_PREFIX}/bookings/edit/${bookingId}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load form');
        }
        
        const html = await response.text();
        modalBody.innerHTML = html;
        
        const form = document.getElementById('bookingForm');
        if (form) {
            form.onsubmit = (e) => handleEditBooking(e, bookingId);
        }
        
        document.querySelector('#createBookingModal .modal-title').textContent = 'ჯავშნის რედაქტირება';
        document.getElementById('createBookingModal').classList.add('active');
    } catch (error) {
        console.error('Error loading edit form:', error);
        showNotification('შეცდომა ფორმის ჩატვირთვისას', 'error');
    }
}

// ====================
// API CALLS
// ====================

// 🎯 DRAG & DROP: Handle event drop
async function handleEventDrop(info) {
    const event = info.event;
    const newStart = event.start;
    const newEnd = event.end;
    
    try {
        const response = await fetch(`/api/admin/bookings/${event.id}/update-datetime`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start_time: newStart.toISOString(),
                end_time: newEnd.toISOString()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('ჯავშანი წარმატებით გადატანილი!', 'success');
            calendar.refetchEvents();
        } else {
            info.revert();
            showNotification('შეცდომა: ' + (data.error || 'დროის შეცვლა ვერ მოხერხდა'), 'error');
        }
    } catch (error) {
        console.error('Error moving booking:', error);
        info.revert();
        showNotification('შეცდომა ჯავშნის გადატანისას', 'error');
    }
}

// 🎯 RESIZE: Handle event resize
async function handleEventResize(info) {
    const event = info.event;
    const newEnd = event.end;
    
    try {
        const response = await fetch(`/api/admin/bookings/${event.id}/update-datetime`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start_time: event.start.toISOString(),
                end_time: newEnd.toISOString()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('ხანგრძლივობა შეიცვალა!', 'success');
            calendar.refetchEvents();
        } else {
            info.revert();
            showNotification('შეცდომა: ' + (data.error || 'ხანგრძლივობის შეცვლა ვერ მოხერხდა'), 'error');
        }
    } catch (error) {
        console.error('Error resizing booking:', error);
        info.revert();
        showNotification('შეცდომა', 'error');
    }
}

// Create new booking
async function handleCreateBooking(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>ჩატვირთვა...</span>';
    
    clearFormErrors();
    
    try {
        const response = await fetch(`${ADMIN_PREFIX}/bookings/new`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message || 'ჯავშანი წარმატებით შეიქმნა!', 'success');
            calendar.refetchEvents();
            closeBookingModal();
        } else {
            if (data.errors) {
                displayFormErrors(data.errors);
            } else {
                showNotification(data.error || 'შეცდომა', 'error');
            }
        }
    } catch (error) {
        console.error('Error creating booking:', error);
        showNotification('შეცდომა ჯავშნის შექმნისას', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>შენახვა</span>
        `;
    }
    
    return false;
}

// Edit existing booking
async function handleEditBooking(event, bookingId) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>ჩატვირთვა...</span>';
    
    clearFormErrors();
    
    try {
        const response = await fetch(`${ADMIN_PREFIX}/bookings/edit/${bookingId}`, {
            method: 'POST',
            body: formData,
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message || 'ჯავშანი წარმატებით განახლდა!', 'success');
            calendar.refetchEvents();
            closeBookingModal();
        } else {
            if (data.errors) {
                displayFormErrors(data.errors);
            } else {
                showNotification(data.error || 'შეცდომა', 'error');
            }
        }
    } catch (error) {
        console.error('Error updating booking:', error);
        showNotification('შეცდომა ჯავშნის განახლებისას', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>განახლება</span>
        `;
    }
    
    return false;
}

// Edit booking
function editBooking(bookingId) {
    closeAllModals();
    setTimeout(() => showEditBookingModal(bookingId), 300);
}

// Delete booking
async function deleteBooking(bookingId) {
    if (!confirm('დარწმუნებული ხართ რომ გსურთ ამ ჯავშნის წაშლა?')) {
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_PREFIX}/bookings/delete/${bookingId}`, {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification(data.message || 'ჯავშანი წაშლილია!', 'success');
            calendar.refetchEvents();
            closeAllModals();
        } else {
            showNotification(data.error || 'შეცდომა წაშლისას', 'error');
        }
    } catch (error) {
        console.error('Error deleting booking:', error);
        showNotification('შეცდომა წაშლისას', 'error');
    }
}

// ====================
// FORM UTILITIES
// ====================
function clearFormErrors() {
    document.querySelectorAll('.form-error').forEach(el => {
        el.textContent = '';
    });
    document.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
        el.style.borderColor = '';
    });
}

function displayFormErrors(errors) {
    for (const [field, message] of Object.entries(errors)) {
        const errorEl = document.getElementById(`error-${field}`);
        const inputEl = document.querySelector(`[name="${field}"]`);
        
        if (errorEl) {
            errorEl.textContent = message;
        }
        
        if (inputEl) {
            inputEl.style.borderColor = '#ef4444';
            inputEl.focus();
        }
    }
}

function closeBookingModal() {
    document.getElementById('createBookingModal').classList.remove('active');
    document.querySelector('#createBookingModal .modal-title').textContent = 'ახალი ჯავშნის შექმნა';
}

// ====================
// UTILITY FUNCTIONS
// ====================
function getStatusLabel(status) {
    const labels = {
        'pending': 'მოლოდინში',
        'confirmed': 'დადასტურებული',
        'completed': 'დასრულებული',
        'cancelled': 'გაუქმებული'
    };
    return labels[status] || status;
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.remove('active');
    });
    currentBookingId = null;
    
    const createModalTitle = document.querySelector('#createBookingModal .modal-title');
    if (createModalTitle) {
        createModalTitle.textContent = 'ახალი ჯავშნის შექმნა';
    }
}

function showNotification(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `
        <span class="toast-icon">${emoji}</span>
        <span class="toast-message">${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}