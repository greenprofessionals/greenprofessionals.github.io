(() => {
  const cfg = window.AIRPORT_PICKUP_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const setText = (id, value) => {
    const el = $(id);
    if (el && value) el.textContent = value;
  };

  setText('eventName', cfg.eventName);
  setText('eventDate', cfg.eventDate);
  setText('hostName', cfg.host);
  setText('hotelName', cfg.hotelName);
  setText('hotelAddress', cfg.hotelAddress);
  setText('deadline', cfg.submissionDeadline);

  const coordinatorBits = [cfg.coordinatorName, cfg.coordinatorPhone, cfg.coordinatorEmail].filter(Boolean);
  if (coordinatorBits.length) setText('coordinator', coordinatorBits.join(' • '));

  const form = $('travelForm');
  const status = $('formStatus');
  const submitBtn = $('submitBtn');
  const endpointWarning = $('endpointWarning');

  const needsOtherHotel = $('hotelChoice');
  const otherHotelWrap = $('otherHotelWrap');
  const checkedBags = $('checkedBags');
  const bagCountWrap = $('bagCountWrap');
  const additionalTravelers = $('additionalTravelerCount');
  const additionalNamesWrap = $('additionalNamesWrap');
  const returnTransport = $('returnTransport');
  const returnSection = $('returnSection');

  function toggleHotel() {
    const show = needsOtherHotel.value === 'Other';
    otherHotelWrap.classList.toggle('hidden', !show);
    $('otherHotel').required = show;
  }
  function toggleBags() {
    const show = checkedBags.value === 'Yes';
    bagCountWrap.classList.toggle('hidden', !show);
    $('checkedBagCount').required = show;
  }
  function toggleAdditionalNames() {
    const count = Number(additionalTravelers.value || 0);
    additionalNamesWrap.classList.toggle('hidden', count < 1);
    $('additionalTravelerNames').required = count > 0;
  }
  function toggleReturn() {
    const show = returnTransport.value === 'Yes';
    returnSection.classList.toggle('hidden', !show);
    returnSection.querySelectorAll('[data-return-required="true"]').forEach(el => el.required = show);
  }

  [needsOtherHotel, checkedBags, additionalTravelers, returnTransport].forEach(el => {
    el.addEventListener('change', () => {
      toggleHotel(); toggleBags(); toggleAdditionalNames(); toggleReturn();
    });
  });
  toggleHotel(); toggleBags(); toggleAdditionalNames(); toggleReturn();

  const isConfigured = /^https:\/\/script\.google\.com\//.test(cfg.scriptUrl || '');
  if (!isConfigured) {
    endpointWarning.classList.remove('hidden');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const selectedChannels = ['email_consent','sms_consent','whatsapp_consent']
      .some(name => form.querySelector(`[name="${name}"]`)?.checked);
    if (!selectedChannels) {
      status.textContent = 'Please select at least one communication method.';
      status.className = 'status error';
      return;
    }

    if (!isConfigured) {
      status.textContent = 'Setup is not complete. Add the deployed Apps Script URL to config.js.';
      status.className = 'status error';
      return;
    }

    submitBtn.disabled = true;
    status.textContent = 'Submitting your travel information…';
    status.className = 'status';

    const data = new FormData(form);
    data.append('event_name', cfg.eventName || '');
    data.append('event_date', cfg.eventDate || '');
    data.append('submission_source', window.location.href);
    data.append('browser_timezone', Intl.DateTimeFormat().resolvedOptions().timeZone || '');

    try {
      await fetch(cfg.scriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: data
      });

      form.reset();
      toggleHotel(); toggleBags(); toggleAdditionalNames(); toggleReturn();
      status.textContent = 'Submitted. Your travel information has been sent to the transportation team.';
      status.className = 'status success';
      window.scrollTo({ top: form.offsetTop - 90, behavior: 'smooth' });
    } catch (error) {
      status.textContent = 'The submission could not be sent. Please check your connection and try again.';
      status.className = 'status error';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
