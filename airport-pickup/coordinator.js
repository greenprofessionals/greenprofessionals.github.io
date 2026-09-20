(() => {
  const cfg = window.AIRPORT_PICKUP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const dashboard = $('dashboard');
  const loginPanel = $('loginPanel');
  const accessForm = $('accessForm');
  const accessCode = $('accessCode');
  const accessStatus = $('accessStatus');
  const SESSION_KEY = 'airportPickupCoordinatorToken';
  const chapterFilter = $('chapterFilter');
  const travelerSearch = $('travelerSearch');
  const travelerList = $('travelerList');
  const emptyState = $('emptyState');
  const messageTemplate = $('messageTemplate');
  const messageText = $('messageText');
  const messageQueue = $('messageQueue');
  const messageAudience = $('messageAudience');
  let records = [];
  let coordinatorSession = null;
  let accessRecords = [];
  let currentTravelerIndex = -1;
  const isConfigured = /^https:\/\/script\.google\.com\//.test(cfg.scriptUrl || '');

  const CHAPTERS = ["No Chapter", "Arizona Chapter", "Chicago Chapter", "Dallas Chapter", "Delaware Valley Chapter", "Florida Chapter", "Georgia Chapter", "Houston Chapter", "Iowa Chapter", "Minnesota Chapter", "New England Chapter", "New Jersey Chapter", "New York Chapter", "North Carolina Chapter", "North Dakota Chapter", "Northern California Chapter", "Ohio Chapter", "Seattle-Washington Chapter", "Southern California Chapter", "Virginia Chapter", "Washington DC Chapter"];

  const templates = {
    arrivalReminder: 'Hello {first_name}, this is the SLPP North America Women\'s Council transportation team. Please confirm that your current arrival is {airline} {flight} at {airport}{terminal_clause} on {arrival_date} at {arrival_time}. Reply directly if anything has changed.',
    driverAssigned: 'Hello {first_name}, your airport pickup has been assigned. Driver: {driver}. Phone: {driver_phone}. Vehicle: {vehicle}. Your current pickup status is {status}. Please contact the driver after collecting your luggage.',
    landedCheckin: 'Hello {first_name}, welcome. We are monitoring your arrival at {airport}{terminal_clause}. Please reply when you have landed and again when you have collected your luggage so we can coordinate your pickup.',
    pickupComplete: 'Hello {first_name}, we hope your pickup went smoothly. Our record shows your transportation status as {status}. Please reply if you still need transportation assistance.',
    itineraryUpdate: 'Hello {first_name}, this is the SLPP North America Women\'s Council transportation team. Please send us any updated airline, flight number, airport, terminal, arrival date, or arrival time so we can keep your pickup information current.',
    eventReminder: 'Hello {first_name}, a reminder from the SLPP North America Women\'s Council transportation team. Your recorded drop-off location is {dropoff}. Please keep your phone available for pickup coordination when you arrive.',
    custom: 'Hello {first_name}, '
  };

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!isConfigured) return reject(new Error('Apps Script URL is not configured.'));
      const cb = '__airportPickupCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const script = document.createElement('script');
      const timeout = setTimeout(() => cleanup(new Error('Request timed out.')), 15000);
      function cleanup(err, data) { clearTimeout(timeout); delete window[cb]; script.remove(); err ? reject(err) : resolve(data); }
      window[cb] = data => cleanup(null, data);
      const q = new URLSearchParams({ ...params, callback: cb });
      script.src = cfg.scriptUrl + (cfg.scriptUrl.includes('?') ? '&' : '?') + q.toString();
      script.onerror = () => cleanup(new Error('Could not reach the coordinator service.'));
      document.body.appendChild(script);
    });
  }

  async function loadData() {
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    if (!token) throw new Error('Coordinator login required.');
    const data = await jsonp({ action: 'coordinatorData', session_token: token });
    if (!data?.ok) {
      if (/session|login|expired/i.test(data?.error || '')) {
        sessionStorage.removeItem(SESSION_KEY);
        showLogin(data?.error || 'Coordinator session expired. Please log in again.');
      }
      throw new Error(data?.error || 'Could not load traveler information.');
    }
    records = Array.isArray(data.records) ? data.records : [];
    coordinatorSession = data.coordinator || coordinatorSession;
    loginPanel.classList.add('hidden');
    dashboard.classList.remove('hidden');
    updateCoordinatorIdentity();
    populateChapters(); render(); updateMessageAudience();
    await configureAccessManagement();
  }


  function showLogin(message = '') {
    dashboard.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    accessStatus.textContent = message;
    accessStatus.className = message ? 'status error' : 'status';
    setTimeout(() => accessCode.focus(), 0);
  }

  async function loginCoordinator(password) {
    const data = await jsonp({ action: 'coordinatorLogin', access_code: password });
    if (!data?.ok || !data.sessionToken) throw new Error(data?.error || 'Invalid coordinator password.');
    sessionStorage.setItem(SESSION_KEY, data.sessionToken);
    coordinatorSession = data.coordinator || null;
    accessCode.value = '';
    accessStatus.textContent = '';
    await loadData();
  }

  function logoutCoordinator() {
    sessionStorage.removeItem(SESSION_KEY);
    records = [];
    coordinatorSession = null;
    travelerList.innerHTML = '';
    messageQueue.innerHTML = '';
    showLogin('You have been logged out.');
  }

  function updateCoordinatorIdentity() {
    const el = $('coordinatorIdentity');
    if (!el) return;
    if (!coordinatorSession) { el.textContent = ''; return; }
    el.textContent = `${coordinatorSession.name || 'Coordinator'} · ${coordinatorSession.role || 'Coordinator'}`;
  }

  async function configureAccessManagement() {
    const panel = $('accessManagement');
    if (!panel) return;
    if (!coordinatorSession || coordinatorSession.role !== 'Admin') {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    await loadCoordinatorAccess();
  }

  async function loadCoordinatorAccess() {
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    const data = await jsonp({ action:'coordinatorAccessList', session_token:token });
    if (!data?.ok) throw new Error(data?.error || 'Could not load coordinator access.');
    accessRecords = Array.isArray(data.records) ? data.records : [];
    renderCoordinatorAccess();
  }

  function renderCoordinatorAccess() {
    const wrap = $('coordinatorAccessList');
    if (!wrap) return;
    if (!accessRecords.length) {
      wrap.innerHTML = '<div class="empty-state">No coordinator accounts found.</div>';
      return;
    }
    wrap.innerHTML = accessRecords.map(r => `
      <article class="access-card" data-id="${escapeHtml(r.id)}">
        <div>
          <div class="access-card-head">
            <strong>${escapeHtml(r.name || 'Coordinator')}</strong>
            <span class="role-badge ${String(r.active).toLowerCase()==='yes'?'':'inactive-badge'}">${escapeHtml(r.role || 'Coordinator')} · ${escapeHtml(r.active || 'No')}</span>
          </div>
          <div class="access-card-meta">
            <span>${escapeHtml(r.chapter || 'No Chapter')}</span>
            ${r.lastLogin ? `<span>Last login: ${escapeHtml(r.lastLogin)}</span>` : ''}
          </div>
        </div>
        <div class="access-card-actions">
          <button class="secondary-btn" type="button" data-admin-action="edit" data-id="${escapeHtml(r.id)}">Edit</button>
          <button class="secondary-btn" type="button" data-admin-action="toggle" data-id="${escapeHtml(r.id)}">${String(r.active).toLowerCase()==='yes'?'Deactivate':'Activate'}</button>
          <button class="secondary-btn" type="button" data-admin-action="delete" data-id="${escapeHtml(r.id)}">Remove</button>
        </div>
      </article>`).join('');
    wrap.querySelectorAll('[data-admin-action]').forEach(btn => btn.addEventListener('click', handleAccessAction));
  }

  function resetCoordinatorForm() {
    $('coordinatorId').value = '';
    $('coordinatorName').value = '';
    $('coordinatorPassword').value = '';
    $('coordinatorChapter').value = 'No Chapter';
    $('coordinatorRole').value = 'Coordinator';
    $('coordinatorActive').value = 'Yes';
    $('adminStatus').textContent = '';
  }

  function editCoordinatorRecord(id) {
    const r = accessRecords.find(x => x.id === id);
    if (!r) return;
    $('coordinatorId').value = r.id || '';
    $('coordinatorName').value = r.name || '';
    $('coordinatorPassword').value = '';
    $('coordinatorChapter').value = r.chapter || 'No Chapter';
    $('coordinatorRole').value = r.role || 'Coordinator';
    $('coordinatorActive').value = r.active || 'Yes';
    $('adminStatus').textContent = 'Editing coordinator. Leave password blank to keep the existing password.';
    $('coordinatorName').focus();
  }

  async function handleAccessAction(e) {
    const action = e.currentTarget.dataset.adminAction;
    const id = e.currentTarget.dataset.id;
    if (action === 'edit') return editCoordinatorRecord(id);
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    if (action === 'delete' && !confirm('Remove this coordinator account?')) return;
    const endpoint = action === 'toggle' ? 'coordinatorAccessToggle' : 'coordinatorAccessDelete';
    const data = await jsonp({ action:endpoint, session_token:token, coordinator_id:id });
    if (!data?.ok) return alert(data?.error || 'Could not update coordinator access.');
    await loadCoordinatorAccess();
  }

  async function saveCoordinatorAccess(e) {
    e.preventDefault();
    const status = $('adminStatus');
    status.textContent = 'Saving…';
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    try {
      const data = await jsonp({
        action:'coordinatorAccessSave',
        session_token:token,
        coordinator_id:$('coordinatorId').value,
        name:$('coordinatorName').value,
        access_code:$('coordinatorPassword').value,
        chapter:$('coordinatorChapter').value,
        role:$('coordinatorRole').value,
        active:$('coordinatorActive').value
      });
      if (!data?.ok) throw new Error(data?.error || 'Could not save coordinator.');
      status.textContent = data.message || 'Coordinator saved.';
      await loadCoordinatorAccess();
      resetCoordinatorForm();
    } catch (err) {
      status.textContent = err.message || 'Could not save coordinator.';
      status.className = 'status error';
    }
  }

  function populateChapters() {
    const current = chapterFilter.value;
    const legacy = [...new Set(records.map(r => r.chapter).filter(Boolean).filter(c => !CHAPTERS.includes(c)))].sort((a,b) => a.localeCompare(b));
    const chapters = [...CHAPTERS, ...legacy];
    chapterFilter.innerHTML = '<option value="">All Chapters / Regions</option>' + chapters.map(c => `<option>${escapeHtml(c)}</option>`).join('');
    if (chapters.includes(current)) chapterFilter.value = current;
  }

  function filteredRecords() {
    const chapter = chapterFilter.value;
    const q = travelerSearch.value.trim().toLowerCase();
    return records.filter(r => (!chapter || r.chapter === chapter) && (!q || (r.name || '').toLowerCase().includes(q)));
  }

  function render() {
    const shown = filteredRecords(); const chapter = chapterFilter.value;
    $('travelerHeading').textContent = chapter || 'All Travelers';
    $('travelerSubheading').textContent = `${shown.length} traveler submission${shown.length === 1 ? '' : 's'}`;
    $('kpiTotal').textContent = shown.reduce((sum, r) => sum + Number(r.partySize || 1), 0);
    $('kpiParties').textContent = shown.length;
    $('kpiAssigned').textContent = shown.filter(r => r.pickupStatus && !['Not Assigned','Cancelled'].includes(r.pickupStatus)).length;
    $('kpiPickedUp').textContent = shown.filter(r => ['Picked Up','Dropped Off'].includes(r.pickupStatus)).length;
    travelerList.innerHTML = shown.map(r => {
      const realIndex = records.indexOf(r); const phoneHref = telHref(r.phone);
      const assignmentLabel = r.pickupAssignedTo ? 'Update Driver' : 'Assign Driver';
      return `<article class="traveler-card" data-index="${realIndex}"><button class="traveler-open" type="button" data-index="${realIndex}" aria-label="Open ${escapeHtml(r.name || 'traveler')} details"><span class="traveler-avatar">${initials(r.name)}</span><span class="traveler-card-main"><strong>${escapeHtml(r.name || 'Traveler')}</strong><span class="traveler-phone">${escapeHtml(r.phone || 'Phone not provided')}</span><span class="traveler-route">${escapeHtml(shortAirport(r.arrivalAirport) || 'Airport TBD')} · ${escapeHtml(r.arrivalTerminal ? 'Terminal ' + r.arrivalTerminal : 'Terminal TBD')} · ${escapeHtml(r.airline || 'Airline TBD')}</span></span><span class="chevron">›</span></button><div class="traveler-quick-actions">${phoneHref ? `<a class="contact-btn call" href="${phoneHref}">Call</a><a class="contact-btn sms" href="${smsHref(r.phone)}">Text</a><a class="contact-btn whatsapp" href="${waHref(r.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button class="contact-btn assign-driver-btn" type="button" data-index="${realIndex}">${assignmentLabel}</button><span class="status-pill ${statusClass(r.pickupStatus)}">${escapeHtml(r.pickupStatus || 'Not Assigned')}</span></div></article>`;
    }).join('');
    emptyState.classList.toggle('hidden', shown.length > 0);
    travelerList.querySelectorAll('.traveler-open').forEach(btn => btn.addEventListener('click', () => openTraveler(Number(btn.dataset.index))));
    travelerList.querySelectorAll('.assign-driver-btn').forEach(btn => btn.addEventListener('click', () => openTraveler(Number(btn.dataset.index), true)));
    updateMessageAudience();
  }

  function openTraveler(index, focusAssignment = false) {
    const r = records[index]; if (!r) return;
    currentTravelerIndex = index;
    $('modalTitle').textContent = r.name || 'Traveler'; $('modalChapter').textContent = r.chapter || 'Chapter / Region not provided';
    $('modalStatus').textContent = r.pickupStatus || 'Not Assigned'; $('modalStatus').className = 'status-pill ' + statusClass(r.pickupStatus);
    const phone = r.phone || '';
    $('contactActions').innerHTML = phone ? `<a class="contact-btn call" href="${telHref(phone)}">Call ${escapeHtml(phone)}</a><a class="contact-btn sms" href="${smsHref(phone)}">Text</a><a class="contact-btn whatsapp" href="${waHref(phone)}" target="_blank" rel="noopener">WhatsApp</a>` : '<span class="status error">Phone number not available.</span>';
    const details = [['Airport',r.arrivalAirport],['Terminal',r.arrivalTerminal||'Not provided'],['Airline',r.airline],['Flight Number',r.flightNumber],['Arrival Date',r.arrivalDate],['Scheduled Arrival',r.scheduledArrivalTime],['Origin',r.departureCityAirport],['Party Size',r.partySize],['Checked Bags',bagText(r)],['Drop-Off',r.dropoff],['Return Transportation',r.returnTransportationNeeded],['Departure Date',r.departureDate],['Departure Airport',r.departureAirport],['Departure Airline',r.departureAirline],['Departure Flight',r.departureFlightNumber],['Departure Time',r.scheduledDepartureTime],['Assigned Driver',r.pickupAssignedTo],['Driver Phone',r.driverPhone],['Vehicle',r.vehicle],['Actual Arrival',r.actualArrivalTime],['Passenger Contacted',r.passengerContacted],['Picked Up',r.pickedUp],['Dropped Off',r.droppedOff]].filter(([,v])=>v!==''&&v!==null&&v!==undefined);
    $('modalBody').innerHTML = details.map(([label,value])=>`<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
    populateDriverAssignment(r);
    $('travelerModal').classList.remove('hidden'); document.body.classList.add('modal-open');
    if (focusAssignment) setTimeout(() => $('driverName')?.focus(), 80);
  }

  function populateDriverAssignment(r) {
    $('driverName').value = r.pickupAssignedTo || '';
    $('driverPhone').value = r.driverPhone || '';
    $('driverVehicle').value = r.vehicle || '';
    $('driverPickupStatus').value = r.pickupStatus || 'Not Assigned';
    $('driverAssignmentStatus').textContent = '';
    renderDriverContactActions(r);
  }

  function renderDriverContactActions(r) {
    const wrap = $('driverContactActions');
    if (!wrap) return;
    const d = digits(r.driverPhone);
    if (!d) { wrap.innerHTML = r.pickupAssignedTo ? '<span class="status">Driver phone not provided.</span>' : ''; return; }
    wrap.innerHTML = `<a class="contact-btn call" href="tel:+${d}">Call Driver</a><a class="contact-btn sms" href="sms:+${d}">Text Driver</a><a class="contact-btn whatsapp" href="https://wa.me/${d}" target="_blank" rel="noopener">WhatsApp Driver</a>`;
  }

  async function saveDriverAssignment(e) {
    e.preventDefault();
    const r = records[currentTravelerIndex];
    if (!r || !r.submissionId) { alert('Traveler record ID is unavailable. Refresh and try again.'); return; }
    const token = sessionStorage.getItem(SESSION_KEY) || '';
    const driverName = $('driverName').value.trim();
    const driverPhone = $('driverPhone').value.trim();
    const vehicle = $('driverVehicle').value.trim();
    let pickupStatus = $('driverPickupStatus').value || 'Not Assigned';
    if (driverName && pickupStatus === 'Not Assigned') pickupStatus = 'Driver Assigned';
    $('driverPickupStatus').value = pickupStatus;
    const status = $('driverAssignmentStatus');
    status.textContent = 'Saving…'; status.className = 'status';
    $('saveDriverAssignment').disabled = true;
    try {
      const data = await jsonp({ action:'driverAssignmentSave', session_token:token, submission_id:r.submissionId, driver_name:driverName, driver_phone:driverPhone, vehicle:vehicle, pickup_status:pickupStatus });
      if (!data?.ok) throw new Error(data?.error || 'Could not save driver assignment.');
      records[currentTravelerIndex] = { ...r, ...(data.record || {}), pickupAssignedTo:driverName, driverPhone:driverPhone, vehicle:vehicle, pickupStatus:pickupStatus };
      status.textContent = data.message || 'Driver assignment saved.'; status.className = 'status success';
      render();
      openTraveler(currentTravelerIndex);
      $('driverAssignmentStatus').textContent = data.message || 'Driver assignment saved.'; $('driverAssignmentStatus').className = 'status success';
    } catch (err) {
      status.textContent = err.message || 'Could not save driver assignment.'; status.className = 'status error';
    } finally { $('saveDriverAssignment').disabled = false; }
  }

  async function clearDriverAssignment() {
    $('driverName').value = ''; $('driverPhone').value = ''; $('driverVehicle').value = ''; $('driverPickupStatus').value = 'Not Assigned';
    await saveDriverAssignment({ preventDefault(){} });
  }

  function personalize(template, r) {
    const first = String(r.name || 'Traveler').trim().split(/\s+/)[0] || 'Traveler';
    const vals = {
      first_name:first, name:r.name||'Traveler', chapter:r.chapter||'', airport:shortAirport(r.arrivalAirport)||r.arrivalAirport||'', terminal:r.arrivalTerminal||'', terminal_clause:r.arrivalTerminal ? `, Terminal ${r.arrivalTerminal}` : '', airline:r.airline||'', flight:r.flightNumber||'', arrival_date:r.arrivalDate||'', arrival_time:r.scheduledArrivalTime||'', driver:r.pickupAssignedTo||'TBD', driver_phone:r.driverPhone||'TBD', vehicle:r.vehicle||'TBD', status:r.pickupStatus||'Not Assigned', dropoff:r.dropoff||'TBD'
    };
    return template.replace(/\{([a-z_]+)\}/g, (_,k) => vals[k] ?? '');
  }

  function buildMessageQueue() {
    const shown = filteredRecords(); const template = messageText.value.trim();
    if (!template) { alert('Enter or choose a message template first.'); return; }
    messageQueue.innerHTML = shown.map(r => {
      const d=digits(r.phone); const msg=personalize(template,r); const sms=d?`sms:+${d}?body=${encodeURIComponent(msg)}`:'#'; const wa=d?`https://wa.me/${d}?text=${encodeURIComponent(msg)}`:'#';
      return `<article class="message-queue-card"><div><strong>${escapeHtml(r.name||'Traveler')}</strong><span>${escapeHtml(r.chapter||'')}</span><p>${escapeHtml(msg)}</p></div><div class="message-queue-actions">${d?`<a class="contact-btn sms" href="${sms}">Text</a><a class="contact-btn whatsapp" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:'<span class="status error">No valid phone</span>'}</div></article>`;
    }).join('');
    if (!shown.length) messageQueue.innerHTML='<div class="empty-state">No travelers are in the current audience.</div>';
  }

  function insertPlaceholder(token) {
    if (!token) return;
    const start = Number.isInteger(messageText.selectionStart) ? messageText.selectionStart : messageText.value.length;
    const end = Number.isInteger(messageText.selectionEnd) ? messageText.selectionEnd : start;
    const before = messageText.value.slice(0, start);
    const after = messageText.value.slice(end);
    messageText.value = before + token + after;
    const caret = start + token.length;
    messageText.focus();
    messageText.setSelectionRange(caret, caret);
    messageText.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function updateTemplate(){ messageText.value = templates[messageTemplate.value] || ''; }
  function updateMessageAudience(){ if(messageAudience) messageAudience.textContent = `${filteredRecords().length} traveler${filteredRecords().length===1?'':'s'} in current audience`; }
  function closeModal(){ $('travelerModal').classList.add('hidden'); document.body.classList.remove('modal-open'); }

  accessForm.addEventListener('submit', async e => {
    e.preventDefault();
    accessStatus.textContent = 'Checking…';
    accessStatus.className = 'status';
    try { await loginCoordinator(accessCode.value); }
    catch (err) { accessStatus.textContent = err.message || 'Could not sign in.'; accessStatus.className = 'status error'; }
  });
  chapterFilter.addEventListener('change', render); travelerSearch.addEventListener('input', render);
  $('refreshBtn').addEventListener('click', async()=>{ $('refreshBtn').disabled=true; try{await loadData();}catch(err){if(!/session|login|expired/i.test(err.message||''))alert(err.message||'Could not refresh traveler information.');}finally{$('refreshBtn').disabled=false;} });
  $('logoutBtn').addEventListener('click', logoutCoordinator);
  $('modalClose').addEventListener('click',closeModal); $('travelerModal').addEventListener('click',e=>{if(e.target.dataset.closeModal==='true')closeModal();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  messageTemplate.addEventListener('change', updateTemplate); $('buildMessageQueue').addEventListener('click', buildMessageQueue); document.querySelectorAll('[data-placeholder]').forEach(btn => btn.addEventListener('click', () => insertPlaceholder(btn.dataset.placeholder))); updateTemplate();
  if ($('coordinatorAdminForm')) $('coordinatorAdminForm').addEventListener('submit', saveCoordinatorAccess);
  if ($('cancelCoordinatorEdit')) $('cancelCoordinatorEdit').addEventListener('click', resetCoordinatorForm);
  if ($('driverAssignmentForm')) $('driverAssignmentForm').addEventListener('submit', saveDriverAssignment);
  if ($('clearDriverAssignment')) $('clearDriverAssignment').addEventListener('click', clearDriverAssignment);

  if (!isConfigured) {
    showLogin('Administrator setup required: add the deployed Apps Script URL to config.js.');
  } else if (sessionStorage.getItem(SESSION_KEY)) {
    loadData().catch(err => { if (!/session|login|expired/i.test(err.message || '')) showLogin(err.message || 'Could not load traveler information.'); });
  } else {
    showLogin();
  }

  function digits(v){return String(v||'').replace(/\D/g,'');} function telHref(v){const d=digits(v);return d?'tel:+'+d:'';} function smsHref(v){const d=digits(v);return d?'sms:+'+d:'#';} function waHref(v){const d=digits(v);return d?'https://wa.me/'+d:'#';} function shortAirport(v){const s=String(v||'');const m=s.match(/^(BWI|DCA|IAD)/);return m?m[1]:s;} function bagText(r){return r.checkedBags==='Yes'?`${r.checkedBagCount||''} checked bag${String(r.checkedBagCount)==='1'?'':'s'}`.trim():(r.checkedBags||'No');} function initials(name){return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();} function statusClass(s){return 'status-'+String(s||'not-assigned').toLowerCase().replace(/[^a-z0-9]+/g,'-');} function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
})();
