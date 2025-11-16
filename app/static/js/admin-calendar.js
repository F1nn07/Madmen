// FullCalendar.js Integration for BarberFlow Admin Panel
// Complete implementation with all features

let calendar;
let currentBarberFilter = 'all';
let currentBookingId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    setupEventListeners();
});

// ====================
// CALENDAR INITIALIZATION
// ====================
function initializeCalendar() {
    const calendarEl = document.getElementById('booking-calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        // Initial view - კვირის ხედი როგორც მთავარი
        initialView: 'timeGridWeek',
        
        // Header toolbar with view switching buttons
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        
        // Button text in Georgian
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
        
        // Display settings
        height: 'auto',
        expandRows: true,
        nowIndicator: true,
        
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
            info.jsEvent.preventDefault(); // Prevent navigation
            showEventDetailsModal(info.event);
        },
        
        // ინტერაქცია (2) - ცარიელ ადგილზე დაკლიკება
        dateClick: function(info) {
            // Only allow creation in week/day views
            const view = calendar.view.type;
            if (view === 'timeGridWeek' || view === 'timeGridDay') {
                showCreateBookingModal(info.dateStr, info.date);
            } else {
                // In month view, just navigate to that day
                calendar.changeView('timeGridDay', info.dateStr);
            }
        },
        
        // Optional: enable drag & drop (future feature)
        editable: false,
        droppable: false,
        
        // Event styling
        eventDidMount: function(info) {
            // Add tooltip
            const status = info.event.extendedProps.status;
            const statusText = getStatusLabel(status);
            info.el.title = `${info.event.title}\n${statusText}`;
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
    
    // Modal close buttons
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAllModals();
            }
        });
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ====================
// MODAL 1: EVENT DETAILS (არსებული ჯავშანი)
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
    
    // Build modal content
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
        
        <div class="status-buttons">
            <button class="btn-status pending" onclick="updateStatus(${event.id}, 'pending')">
                ⏳ მოლოდინში
            </button>
            <button class="btn-status confirmed" onclick="updateStatus(${event.id}, 'confirmed')">
                ✅ დადასტურება
            </button>
            <button class="btn-status completed" onclick="updateStatus(${event.id}, 'completed')">
                ✔️ დასრულება
            </button>
            <button class="btn-status cancelled" onclick="updateStatus(${event.id}, 'cancelled')">
                ❌ გაუქმება
            </button>
        </div>
        
        <div class="modal-actions">
            <button class="btn-modal btn-edit" onclick="editBooking(${event.id})">
                ✏️ რედაქტირება
            </button>
            <button class="btn-modal btn-delete" onclick="deleteBooking(${event.id})">
                🗑️ წაშლა
            </button>
            <button class="btn-modal btn-secondary" onclick="closeAllModals()">
                დახურვა
            </button>
        </div>
    `;
    
    document.getElementById('eventDetailsModal').classList.add('active');
}

// ====================
// MODAL 2: CREATE BOOKING (ახალი ჯავშანი)
// ====================
async function showCreateBookingModal(dateStr, dateObj) {
    const modalBody = document.getElementById('createModalBody');
    
    // Format date and time
    const date = dateStr.split('T')[0];
    const time = dateStr.split('T')[1]?.substring(0, 5) || '10:00';
    
    try {
        // Load form via AJAX
        const response = await fetch(`/admin/bookings/new?date=${date}&time=${time}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load form');
        }
        
        const html = await response.text();
        modalBody.innerHTML = html;
        
        // Setup form submission
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

// Edit booking modal
async function showEditBookingModal(bookingId) {
    const modalBody = document.getElementById('createModalBody');
    
    try {
        // Load form via AJAX
        const response = await fetch(`/admin/bookings/edit/${bookingId}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load form');
        }
        
        const html = await response.text();
        modalBody.innerHTML = html;
        
        // Setup form submission
        const form = document.getElementById('bookingForm');
        if (form) {
            form.onsubmit = (e) => handleEditBooking(e, bookingId);
        }
        
        // Change modal title
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

// Update booking status
async function updateStatus(bookingId, newStatus) {
    if (!confirm(`დარწმუნებული ხართ რომ გსურთ სტატუსის შეცვლა: ${getStatusLabel(newStatus)}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/bookings/${bookingId}/update-status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('სტატუსი წარმატებით განახლდა!', 'success');
            calendar.refetchEvents();
            closeAllModals();
        } else {
            showNotification('შეცდომა: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('შეცდომა სტატუსის განახლებისას', 'error');
    }
}

// Create new booking
async function handleCreateBooking(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>ჩატვირთვა...</span>';
    
    // Clear previous errors
    clearFormErrors();
    
    try {
        const response = await fetch('/admin/bookings/new', {
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
            // Show validation errors
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
        // Re-enable submit button
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
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>ჩატვირთვა...</span>';
    
    // Clear previous errors
    clearFormErrors();
    
    try {
        const response = await fetch(`/admin/bookings/edit/${bookingId}`, {
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
            // Show validation errors
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
        // Re-enable submit button
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

// Edit booking (redirect to edit page or load modal)
function editBooking(bookingId) {
    // Option 1: Load edit form in modal
    showEditBookingModal(bookingId);
    
    // Option 2: Redirect to separate page (uncomment if preferred)
    // window.location.href = `/admin/bookings/edit/${bookingId}`;
}

// Delete booking
async function deleteBooking(bookingId) {
    if (!confirm('დარწმუნებული ხართ რომ გსურთ ამ ჯავშნის წაშლა?')) {
        return;
    }
    
    try {
        const response = await fetch(`/admin/bookings/delete/${bookingId}`, {
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

// Close booking modal (both create and edit use same modal)
function closeBookingModal() {
    document.getElementById('createBookingModal').classList.remove('active');
    // Reset modal title
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
    
    // Reset create modal title
    const createModalTitle = document.querySelector('#createBookingModal .modal-title');
    if (createModalTitle) {
        createModalTitle.textContent = 'ახალი ჯავშნის შექმნა';
    }
}

function showNotification(message, type = 'info') {
    // Simple notification - შეგიძლიათ შეცვალოთ toast library-ით
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    alert(`${emoji} ${message}`);
}