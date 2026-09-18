(() => {
  const cfg = window.AIRPORT_PICKUP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const loginCard = $('loginCard');
  const dashboard = $('dashboard');
  const loginStatus = $('loginStatus');
  const chapterFilter = $('chapterFilter');
  const travelerSearch = $('travelerSearch');
  const travelerList = $('travelerList');
  const emptyState = $('emptyState');
  let records = [];
  let sessionToken = sessionStorage.getItem('airportPickupCoordinatorToken') || '';
  const isConfigured = /^https:\/\/script\.google\.com\//.test(cfg.scriptUrl || '');

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!isConfigured) return reject(new Error('Apps Script URL is not configured.'));
      const cb = '__airportPickupCb_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const script = document.createElement('script');
      const timeout = setTimeout(() => cleanup(new Error('Request timed out.')), 15000);
      function cleanup(err, data) {
        clearTimeout(timeout); delete window[cb]; script.remove(); err ? reject(err) : resolve(data);
      }
      window[cb] = data => cleanup(null, data);
      const q = new URLSearchParams({ ...params, callback: cb });
      script.src = cfg.scriptUrl + (cfg.scriptUrl.includes('?') ? '&' : '?') + q.toString();
      script.onerror = () => cleanup(new Error('Could not reach the coordinator service.'));
      document.body.appendChild(script);
    });
  }

  async function login(code) {
    loginStatus.textContent = 'Verifying access…'; loginStatus.className = 'status';
    const data = await jsonp({ action: 'coordinatorLogin', access_code: code });
    if (!data?.ok || !data.sessionToken) throw new Error(data?.error || 'Access denied.');
    sessionToken = data.sessionToken;
    sessionStorage.setItem('airportPickupCoordinatorToken', sessionToken);
    await loadData();
  }

  async function loadData() {
    const data = await jsonp({ action: 'coordinatorData', session_token: sessionToken });
    if (!data?.ok) throw new Error(data?.error || 'Your coordinator session has expired.');
    records = Array.isArray(data.records) ? data.records : [];
    loginCard.classList.add('hidden'); dashboard.classList.remove('hidden');
    populateChapters(); render();
  }

  function populateChapters() {
    const current = chapterFilter.value;
    const chapters = [...new Set(records.map(r => r.chapter).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    chapterFilter.innerHTML = '<option value="">All Chapters / Regions</option>' + chapters.map(c => `<option>${escapeHtml(c)}</option>`).join('');
    if (chapters.includes(current)) chapterFilter.value = current;
  }

  function filteredRecords() {
    const chapter = chapterFilter.value;
    const q = travelerSearch.value.trim().toLowerCase();
    return records.filter(r => (!chapter || r.chapter === chapter) && (!q || (r.name || '').toLowerCase().includes(q)));
  }

  function render() {
    const shown = filteredRecords();
    const chapter = chapterFilter.value;
    $('travelerHeading').textContent = chapter || 'All Travelers';
    $('travelerSubheading').textContent = `${shown.length} traveler submission${shown.length === 1 ? '' : 's'}`;
    $('kpiTotal').textContent = shown.reduce((sum, r) => sum + Number(r.partySize || 1), 0);
    $('kpiParties').textContent = shown.length;
    $('kpiAssigned').textContent = shown.filter(r => r.pickupStatus && !['Not Assigned','Cancelled'].includes(r.pickupStatus)).length;
    $('kpiPickedUp').textContent = shown.filter(r => ['Picked Up','Dropped Off'].includes(r.pickupStatus)).length;

    travelerList.innerHTML = shown.map(r => {
      const realIndex = records.indexOf(r);
      const phoneHref = telHref(r.phone);
      return `<article class="traveler-card" data-index="${realIndex}">
        <button class="traveler-open" type="button" data-index="${realIndex}" aria-label="Open ${escapeHtml(r.name || 'traveler')} details">
          <span class="traveler-avatar">${initials(r.name)}</span>
          <span class="traveler-card-main">
            <strong>${escapeHtml(r.name || 'Traveler')}</strong>
            <span class="traveler-phone">${escapeHtml(r.phone || 'Phone not provided')}</span>
            <span class="traveler-route">${escapeHtml(shortAirport(r.arrivalAirport) || 'Airport TBD')} · ${escapeHtml(r.arrivalTerminal ? 'Terminal ' + r.arrivalTerminal : 'Terminal TBD')} · ${escapeHtml(r.airline || 'Airline TBD')}</span>
          </span>
          <span class="chevron">›</span>
        </button>
        <div class="traveler-quick-actions">
          ${phoneHref ? `<a class="contact-btn call" href="${phoneHref}">Call</a><a class="contact-btn sms" href="${smsHref(r.phone)}">Text</a><a class="contact-btn whatsapp" href="${waHref(r.phone)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          <span class="status-pill ${statusClass(r.pickupStatus)}">${escapeHtml(r.pickupStatus || 'Not Assigned')}</span>
        </div>
      </article>`;
    }).join('');
    emptyState.classList.toggle('hidden', shown.length > 0);
    travelerList.querySelectorAll('.traveler-open').forEach(btn => btn.addEventListener('click', () => openTraveler(Number(btn.dataset.index))));
  }

  function openTraveler(index) {
    const r = records[index]; if (!r) return;
    $('modalTitle').textContent = r.name || 'Traveler';
    $('modalChapter').textContent = r.chapter || 'Chapter / Region not provided';
    $('modalStatus').textContent = r.pickupStatus || 'Not Assigned';
    $('modalStatus').className = 'status-pill ' + statusClass(r.pickupStatus);
    const phone = r.phone || '';
    $('contactActions').innerHTML = phone ? `<a class="contact-btn call" href="${telHref(phone)}">Call ${escapeHtml(phone)}</a><a class="contact-btn sms" href="${smsHref(phone)}">Text</a><a class="contact-btn whatsapp" href="${waHref(phone)}" target="_blank" rel="noopener">WhatsApp</a>` : '<span class="status error">Phone number not available.</span>';
    const details = [
      ['Airport', r.arrivalAirport], ['Terminal', r.arrivalTerminal || 'Not provided'], ['Airline', r.airline],
      ['Flight Number', r.flightNumber], ['Arrival Date', r.arrivalDate], ['Scheduled Arrival', r.scheduledArrivalTime],
      ['Origin', r.departureCityAirport], ['Party Size', r.partySize], ['Checked Bags', bagText(r)], ['Drop-Off', r.dropoff],
      ['Return Transportation', r.returnTransportationNeeded], ['Departure Date', r.departureDate], ['Departure Airport', r.departureAirport],
      ['Departure Airline', r.departureAirline], ['Departure Flight', r.departureFlightNumber], ['Departure Time', r.scheduledDepartureTime],
      ['Assigned Driver', r.pickupAssignedTo], ['Driver Phone', r.driverPhone], ['Vehicle', r.vehicle], ['Actual Arrival', r.actualArrivalTime],
      ['Passenger Contacted', r.passengerContacted], ['Picked Up', r.pickedUp], ['Dropped Off', r.droppedOff]
    ].filter(([,v]) => v !== '' && v !== null && v !== undefined);
    $('modalBody').innerHTML = details.map(([label, value]) => `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('');
    $('travelerModal').classList.remove('hidden'); document.body.classList.add('modal-open');
  }

  function closeModal() { $('travelerModal').classList.add('hidden'); document.body.classList.remove('modal-open'); }
  function lockBoard() { sessionStorage.removeItem('airportPickupCoordinatorToken'); sessionToken=''; records=[]; dashboard.classList.add('hidden'); loginCard.classList.remove('hidden'); $('accessCode').value=''; loginStatus.textContent=''; }

  $('loginForm').addEventListener('submit', async e => { e.preventDefault(); try { await login($('accessCode').value.trim()); $('accessCode').value=''; } catch(err) { loginStatus.textContent=err.message || 'Access denied.'; loginStatus.className='status error'; }});
  chapterFilter.addEventListener('change', render); travelerSearch.addEventListener('input', render);
  $('refreshBtn').addEventListener('click', async () => { try { await loadData(); } catch(err) { lockBoard(); loginStatus.textContent=err.message || 'Session expired.'; loginStatus.className='status error'; }});
  $('lockBtn').addEventListener('click', lockBoard);
  $('modalClose').addEventListener('click', closeModal); $('travelerModal').addEventListener('click', e => { if(e.target.dataset.closeModal==='true') closeModal(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

  if (sessionToken && isConfigured) loadData().catch(lockBoard);
  if (!isConfigured) { loginStatus.textContent='Administrator setup required: add the deployed Apps Script URL to config.js.'; loginStatus.className='status error'; }

  function digits(v){ return String(v||'').replace(/\D/g,''); }
  function telHref(v){ const d=digits(v); return d ? 'tel:+'+d : ''; }
  function smsHref(v){ const d=digits(v); return d ? 'sms:+'+d : '#'; }
  function waHref(v){ const d=digits(v); return d ? 'https://wa.me/'+d : '#'; }
  function shortAirport(v){ const s=String(v||''); const m=s.match(/^(BWI|DCA|IAD)/); return m ? m[1] : s; }
  function bagText(r){ return r.checkedBags==='Yes' ? `${r.checkedBagCount || ''} checked bag${String(r.checkedBagCount)==='1'?'':'s'}`.trim() : (r.checkedBags || 'No'); }
  function initials(name){ return String(name||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase(); }
  function statusClass(s){ return 'status-' + String(s||'not-assigned').toLowerCase().replace(/[^a-z0-9]+/g,'-'); }
  function escapeHtml(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
})();
