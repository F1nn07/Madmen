const ADMIN_PREFIX = '/madmen-secure-admin-2024';
let calendar;
const isMobile = () => window.innerWidth < 768;

// 🎨 ბარბერების ფერები
const barberColors = {
    1: '#3b82f6',  // ლურჯი
    2: '#8b5cf6',  // იისფერი
    3: '#ec4899',  // ვარდისფერი
    4: '#f59e0b',  // ნარინჯისფერი
    5: '#10b981',  // მწვანე
    6: '#ef4444'   // წითელი
};

function getBarberColor(barberId) {
    return barberColors[barberId] || '#6b7280';
}

document.addEventListener('DOMContentLoaded', function() {
    initializeCalendar();
    setupEventListeners();
    
    if (isMobile()) {
        setupMobileGestures();
    }
    
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            calendar.destroy();
            initializeCalendar();
            if (isMobile()) {
                setupMobileGestures();
            }
        }, 300);
    });
});

// 📱 Mobile Swipe Gestures
function setupMobileGestures() {
    const calendarEl = document.getElementById('booking-calendar');
    let touchStartX = 0;
    let touchEndX = 0;
    
    calendarEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    
    calendarEl.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                calendar.next();
                updateGeorgianTitle();
            } else {
                calendar.prev();
                updateGeorgianTitle();
            }
        }
    }
}

// ✅ ქართული თარიღების ფორმატირება
function updateGeorgianTitle() {
    const monthNames = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
    const dayNamesShort = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
    const dayNamesFull = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
    
    const titleEl = document.querySelector('.fc-toolbar-title');
    if (titleEl) {
        titleEl.style.opacity = '0';
    }
    
    setTimeout(() => {
        if (titleEl && calendar) {
            const view = calendar.view;
            const currentDate = view.currentStart;
            const endDate = view.currentEnd;
            
            if (view.type === 'resourceTimeGridDay' || view.type === 'timeGridDay') {
                const day = currentDate.getDate();
                const month = monthNames[currentDate.getMonth()];
                const year = currentDate.getFullYear();
                const weekday = dayNamesFull[currentDate.getDay()];
                titleEl.textContent = `${day} ${month}, ${year}, ${weekday}`;
            } else if (view.type === 'timeGridWeek') {
                const startDay = currentDate.getDate();
                const endDay = new Date(endDate.getTime() - 86400000).getDate();
                const month = monthNames[currentDate.getMonth()];
                const year = currentDate.getFullYear();
                titleEl.textContent = `${startDay}-${endDay} ${month}, ${year}`;
            } else if (view.type === 'dayGridMonth') {
                const month = monthNames[currentDate.getMonth()];
                const year = currentDate.getFullYear();
                titleEl.textContent = `${month} ${year}`;
            }
            
            titleEl.style.transition = 'opacity 0.2s ease';
            titleEl.style.opacity = '1';
        }
        
        // Day Headers ფორმატირება
        document.querySelectorAll('.fc-col-header-cell-cushion').forEach(header => {
            const text = header.textContent.trim();
            const match = text.match(/(\d+)/);
            if (match) {
                const dayNum = match[1];
                const dateStr = header.closest('.fc-col-header-cell').getAttribute('data-date');
                if (dateStr) {
                    const date = new Date(dateStr);
                    const georgianDay = dayNamesShort[date.getDay()];
                    header.textContent = `${dayNum} ${georgianDay}`;
                }
            }
        });
        
        // dayGridMonth view-ის სათაურები
        if (calendar.view.type === 'dayGridMonth') {
            const dayHeaders = document.querySelectorAll('.fc-col-header-cell');
            dayHeaders.forEach((cell, index) => {
                const inner = cell.querySelector('.fc-scrollgrid-sync-inner, .fc-col-header-cell-cushion');
                if (inner) {
                    const dayIndex = (index + 1) % 7;
                    inner.textContent = dayNamesShort[dayIndex];
                }
            });
        }
    }, 10);
}

function initializeCalendar() {
    const calendarEl = document.getElementById('booking-calendar');
    const mobile = isMobile();
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        // ✅ Desktop: Resources View, Mobile: Simple Day View
        initialView: mobile ? 'timeGridDay' : 'resourceTimeGridDay',
        
        // ✅ Scheduler License Key
        schedulerLicenseKey: 'GPL-My-Project-Is-Open-Source',
        
        headerToolbar: {
            left: mobile ? 'prev,next' : 'prev,next today',
            center: 'title',
            right: mobile ? 'timeGridDay' : 'resourceTimeGridDay,timeGridWeek,timeGridDay,dayGridMonth'
        },
        
        // ✅ ქართული ლოკალიზაცია (FullCalendar v6 syntax)
        locale: 'ka',
        buttonText: {
            prev: 'უკან',
            next: 'წინ',
            today: 'დღეს',
            month: 'თვე',
            week: 'კვირა',
            day: 'დღე'
        },
        
        firstDay: 1, // ორშაბათი
        slotMinTime: '09:00:00',
        slotMaxTime: '21:00:00',
        slotDuration: '00:15:00',
        slotLabelInterval: '01:00',
        height: 'auto',
        expandRows: true,
        nowIndicator: true,
        
        slotLabelFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        
        // ✅ Resources (ბარბერები) ჩატვირთვა
        resources: function(fetchInfo, successCallback, failureCallback) {
            fetch('/api/barbers')
                .then(res => {
                    if (!res.ok) throw new Error('Network error');
                    return res.json();
                })
                .then(data => {
                    if (data.success && data.barbers) {
                        const resources = data.barbers.map(barber => ({
                            id: barber.id.toString(),
                            title: barber.name,
                            eventColor: getBarberColor(barber.id)
                        }));
                        successCallback(resources);
                    } else {
                        console.error('Barbers API error:', data);
                        successCallback([]); // Empty array if fails
                    }
                })
                .catch(err => {
                    console.error('Error loading barbers:', err);
                    successCallback([]); // Empty array if fails
                });
        },
        
        // ✅ Resource Label Configuration
        resourceAreaHeaderContent: '✂️ ბარბერები',
        resourceAreaWidth: '180px',
        
        // ✅ Events (ჯავშნები) ჩატვირთვა
        events: function(fetchInfo, successCallback, failureCallback) {
            const url = buildEventsUrl(
                fetchInfo.start.toISOString(),
                fetchInfo.end.toISOString()
            );
            
            fetch(url)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    return res.json();
                })
                .then(data => {
                    console.log('📊 Events API Response:', data);
                    
                    // ✅ Support ორივე format: Array ან {success, events}
                    let events = [];
                    
                    if (Array.isArray(data)) {
                        // Format 1: პირდაპირ Array
                        events = data;
                        console.log('✅ Direct array format:', events.length, 'events');
                    } else if (data.success && data.events) {
                        // Format 2: {success: true, events: [...]}
                        events = data.events;
                        console.log('✅ Object format:', events.length, 'events');
                    } else {
                        console.error('❌ Unknown format:', data);
                        failureCallback('Invalid response format');
                        return;
                    }
                    
                    // ✅ თითოეულ event-ს ვუმატებთ resourceId-ს
                    const processedEvents = events.map(event => ({
                        ...event,
                        resourceId: event.barber_id ? event.barber_id.toString() : null
                    }));
                    
                    console.log('✅ Processed events:', processedEvents.length);
                    successCallback(processedEvents);
                    setTimeout(updateGeorgianTitle, 50);
                })
                .catch(err => {
                    console.error('Events fetch error:', err);
                    failureCallback(err);
                });
        },
        
        dateClick: function(info) {
            const barberId = info.resource ? info.resource.id : null;
            showCreateBookingModal(info.dateStr, barberId);
        },
        
        eventClick: function(info) {
            info.jsEvent.preventDefault();
            showEventDetailsModal(info.event);
        },
        
        editable: !mobile,
        eventDrop: handleEventDrop,
        eventResize: handleEventResize,
        
        datesSet: function() {
            updateGeorgianTitle();
        }
    });
    
    calendar.render();
}

function buildEventsUrl(start, end) {
    // ✅ სწორი URL: /api/admin/all-bookings (არა /madmen-secure-admin-2024/api/all-bookings)
    let url = `/api/admin/all-bookings?start=${start}&end=${end}`;
    const filter = document.getElementById('barberFilter');
    if (filter && filter.value !== 'all') {
        url += `&barber_id=${filter.value}`;
    }
    return url;
}

function setupEventListeners() {
    const filter = document.getElementById('barberFilter');
    if(filter) {
        filter.addEventListener('change', () => calendar.refetchEvents());
    }
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) closeAllModals();
        });
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeAllModals();
    });
}

// ====================
// MODALS
// ====================
function showEventDetailsModal(event) {
    const props = event.extendedProps;
    
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const dateStr = startDate.toLocaleDateString('ka-GE', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
    });
    const timeStr = `${startDate.toLocaleTimeString('ka-GE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    })} - ${endDate.toLocaleTimeString('ka-GE', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    })}`;
    
    const statusColors = {
        'pending': '#f59e0b',
        'confirmed': '#10b981',
        'completed': '#3b82f6',
        'cancelled': '#ef4444',
        'no-show': '#6b7280'
    };
    
    const statusEmojis = {
        'pending': '⏳',
        'confirmed': '✅',
        'completed': '🎉',
        'cancelled': '❌',
        'no-show': '👻'
    };
    
    const statusNames = {
        'pending': 'მოლოდინში',
        'confirmed': 'დადასტურებული',
        'completed': 'დასრულებული',
        'cancelled': 'გაუქმებული',
        'no-show': 'არ გამოცხადდა'
    };
    
    const modalContent = `
        <div style="background: linear-gradient(135deg, rgba(20,20,30,0.95) 0%, rgba(30,30,45,0.95) 100%); backdrop-filter: blur(20px); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); max-width: 500px; margin: 0 auto;">
            <div style="padding: 24px 24px 20px 24px; background: linear-gradient(135deg, rgba(176, 125, 74, 0.15) 0%, rgba(176, 125, 74, 0.05) 100%); border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                    <h2 style="color: white; font-size: 24px; font-weight: 800; margin: 0;">📋 ჯავშნის დეტალები</h2>
                    <button onclick="closeAllModals()" style="background: rgba(255,255,255,0.1); border: none; width: 36px; height: 36px; border-radius: 50%; color: white; font-size: 20px; cursor: pointer;">✕</button>
                </div>
                
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="display: inline-block; padding: 8px 16px; background: ${statusColors[props.status] || '#6b7280'}; color: white; border-radius: 10px; font-weight: 700; font-size: 12px; text-transform: uppercase;">
                        ${statusEmojis[props.status] || '⚪'} ${statusNames[props.status] || props.status}
                    </span>
                    <span style="color: #888; font-size: 12px; font-weight: 600;">ID: ${event.id}</span>
                </div>
            </div>
            
            <div style="padding: 24px;">
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                    <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">👤 კლიენტი</div>
                    <div style="color: white; font-weight: 700; font-size: 16px; margin-bottom: 6px;">${props.customerName || 'უცნობი'}</div>
                    <div style="color: #888; font-size: 13px;">📞 ${props.customerPhone || 'არ არის მითითებული'}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 16px;">
                        <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">✂️ სერვისი</div>
                        <div style="color: white; font-weight: 600; font-size: 14px;">${props.serviceName}</div>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 16px;">
                        <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">👨‍💼 ბარბერი</div>
                        <div style="color: white; font-weight: 600; font-size: 14px;">${props.barberName}</div>
                    </div>
                </div>
                
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 16px; margin-bottom: 16px;">
                    <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🕐 დრო</div>
                    <div style="color: white; font-weight: 600; font-size: 14px; margin-bottom: 4px;">${dateStr}</div>
                    <div style="color: #B07D4A; font-family: monospace; font-size: 16px; font-weight: 700;">${timeStr}</div>
                </div>
                
                ${props.notes ? `
                    <div style="background: rgba(176, 125, 74, 0.1); border: 1px solid rgba(176, 125, 74, 0.2); border-radius: 14px; padding: 16px;">
                        <div style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">💬 შენიშვნა</div>
                        <div style="color: #ccc; font-size: 14px; font-style: italic; line-height: 1.6;">"${props.notes}"</div>
                    </div>
                ` : ''}
            </div>
            
            <div style="padding: 20px 24px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px;">
                <button onclick="editBooking(${event.id})" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 14px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px;">
                    ✏️ რედაქტირება
                </button>
                <button onclick="deleteBooking(${event.id})" style="flex: 1; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 14px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px;">
                    🗑️ წაშლა
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('detailsModalBody').innerHTML = modalContent;
    document.getElementById('eventDetailsModal').classList.remove('hidden');
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// ====================
// CRUD OPERATIONS
// ====================
async function handleEventDrop(info) {
    updateBookingTime(info.event.id, info.event.start, info.event.end, info);
}

async function handleEventResize(info) {
    updateBookingTime(info.event.id, info.event.start, info.event.end, info);
}

async function updateBookingTime(id, start, end, info) {
    try {
        const res = await fetch(`${ADMIN_PREFIX}/api/bookings/${id}/update-datetime`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                start_time: start.toISOString(), 
                end_time: end.toISOString() 
            })
        });
        const data = await res.json();
        
        if(data.success) {
            showNotification('✅ განახლდა!', 'success');
        } else {
            info.revert();
            showNotification('❌ ' + data.error, 'error');
        }
    } catch (e) {
        info.revert();
        showNotification('❌ შეცდომა', 'error');
    }
}

async function deleteBooking(id) {
    if(!confirm('ნამდვილად გსურთ წაშლა?')) return;
    try {
        const res = await fetch(`${ADMIN_PREFIX}/bookings/delete/${id}`, { 
            method: 'POST', 
            headers: {'X-Requested-With': 'XMLHttpRequest'} 
        });
        const data = await res.json();
        if(data.success) {
            showNotification('🗑️ წაიშალა', 'success');
            calendar.refetchEvents();
            closeAllModals();
        }
    } catch (e) { 
        console.error(e); 
        showNotification('❌ შეცდომა', 'error');
    }
}

function showNotification(msg, type = 'info') {
    const existing = document.querySelectorAll('.toast-notification');
    existing.forEach(toast => toast.remove());
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };
    
    const colors = {
        success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        info: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    };
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 20px;">${icons[type] || icons.info}</span>
            <span style="font-weight: 600; font-size: 14px;">${msg}</span>
        </div>
    `;
    
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 24px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
        z-index: 10000;
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Placeholder functions
function showCreateBookingModal(dateStr, barberId) {
    console.log("Open create modal for", dateStr, "Barber ID:", barberId);
}

function editBooking(id) {
    window.location.href = `${ADMIN_PREFIX}/bookings/edit/${id}`;
}