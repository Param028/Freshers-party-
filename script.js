/*
 * EDITABLE EVENT CONFIG
 * Registration submissions use the server-side Supabase API. Configure a real
 * Google Form URL only if the organizers want to enable an optional fallback.
 */
const SITE_CONFIG = {
  event: {
    name: 'FRESHERS',
    shortName: "FRESHERS '26",
    yearShort: "'26",
    issueLabel: 'DATA SCIENCE / OPEN CASTING CALL',
    heroTag: 'OCT 2026',
    tagline: 'Data Science deserves a soundtrack, a spotlight and one ridiculously good entrance.',
    date: '2026-10-22T17:00:00+05:30',
    dateLabel: 'THURSDAY, 22 OCT 2026',
    dateLabelShort: '22 OCT',
    timeLabel: '5:00 PM — 8:30 PM',
    venue: 'TO BE ANNOUNCED',
    venueDetail: 'Data Science Department',
    collegeName: 'DATA SCIENCE DEPARTMENT',
    collegeShort: 'DATA SCIENCE',
    registrationDeadline: '2026-10-19T23:59:59+05:30',
    deadlineLabel: 'MONDAY, 19 OCT 2026',
    deadlineLabelShort: 'MON 19 OCT',
    openDateLabel: '01 OCT',
    auditionDateLabel: 'TO BE ANNOUNCED'
  },
  contacts: {
    instagram: 'https://instagram.com/freshers.northstar',
    instagramLabel: '@freshers.northstar'
  },
  forms: {
    contestant: {
      viewUrl: 'https://docs.google.com/forms/d/e/DEMO_MR_MISS_FORM_ID/viewform',
      actionUrl: 'https://docs.google.com/forms/d/e/DEMO_MR_MISS_FORM_ID/formResponse',
      fieldMap: {
        fullName: 'FULL_NAME_ENTRY_ID', category: 'CATEGORY_ENTRY_ID', year: 'YEAR_ENTRY_ID', branch: 'BRANCH_ENTRY_ID', rollNumber: 'ROLL_ENTRY_ID', phone: 'PHONE_ENTRY_ID', collegeEmail: 'EMAIL_ENTRY_ID', instagram: 'INSTAGRAM_ENTRY_ID', talent: 'TALENT_ENTRY_ID', whyWin: 'WHY_WIN_ENTRY_ID', consent: 'CONSENT_ENTRY_ID'
      }
    },
    performance: {
      viewUrl: 'https://docs.google.com/forms/d/e/DEMO_PERFORMANCE_FORM_ID/viewform',
      actionUrl: 'https://docs.google.com/forms/d/e/DEMO_PERFORMANCE_FORM_ID/formResponse',
      fieldMap: {
        performanceName: 'PERFORMANCE_NAME_ENTRY_ID', leadName: 'LEAD_NAME_ENTRY_ID', phone: 'PHONE_ENTRY_ID', memberCount: 'MEMBER_COUNT_ENTRY_ID', memberNames: 'MEMBER_NAMES_ENTRY_ID', performanceType: 'PERFORMANCE_TYPE_ENTRY_ID', duration: 'DURATION_ENTRY_ID', description: 'DESCRIPTION_ENTRY_ID', needs: 'NEEDS_ENTRY_ID', leadBranchYear: 'LEAD_BRANCH_YEAR_ENTRY_ID', consent: 'CONSENT_ENTRY_ID'
      }
    }
  }
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const isClosed = () => new Date() > new Date(SITE_CONFIG.event.registrationDeadline);

function setTextBindings() {
  const values = {
    shortName: SITE_CONFIG.event.shortName,
    collegeShort: SITE_CONFIG.event.collegeShort,
    issueLabel: SITE_CONFIG.event.issueLabel,
    heroTag: SITE_CONFIG.event.heroTag,
    eventName: SITE_CONFIG.event.name,
    yearShort: SITE_CONFIG.event.yearShort,
    tagline: SITE_CONFIG.event.tagline,
    dateLabel: SITE_CONFIG.event.dateLabel,
    dateLabelShort: SITE_CONFIG.event.dateLabelShort,
    timeLabel: SITE_CONFIG.event.timeLabel,
    venue: SITE_CONFIG.event.venue,
    venueDetail: SITE_CONFIG.event.venueDetail,
    collegeName: SITE_CONFIG.event.collegeName,
    deadlineLabel: SITE_CONFIG.event.deadlineLabel,
    deadlineLabelShort: SITE_CONFIG.event.deadlineLabelShort,
    openDateLabel: SITE_CONFIG.event.openDateLabel,
    auditionDateLabel: SITE_CONFIG.event.auditionDateLabel,
    instagramLabel: SITE_CONFIG.contacts.instagramLabel
  };
  $$('[data-bind]').forEach((node) => {
    const value = values[node.dataset.bind];
    if (value !== undefined) node.textContent = value;
  });
  const instagram = $('[data-bind="instagramLabel"]');
  if (instagram) instagram.href = SITE_CONFIG.contacts.instagram;
  renderCrewContacts([], 'Loading crew contacts…');
  void refreshPublicContacts();
  void refreshPublicVenue();
}

async function refreshPublicVenue() {
  try {
    const response = await fetch('/api/event-settings', { cache: 'no-store' });
    if (!response.ok) return;
    const settings = await response.json();
    const venue = String(settings.venue || '').trim();
    const node = $('[data-bind="venue"]');
    if (venue && node) node.textContent = venue;
  } catch {
    // Keep the default “TO BE ANNOUNCED” venue if the settings endpoint is unavailable.
  }
}

function toE164ContactPhone(value) {
  const phone = String(value ?? '');
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : '';
}

function formatContactPhone(value) {
  const e164 = toE164ContactPhone(value);
  const digitsOnly = normalizePhone(e164);
  return digitsOnly.startsWith('91') && digitsOnly.length === 12
    ? `+91 ${digitsOnly.slice(2, 7)} ${digitsOnly.slice(7)}`
    : e164;
}

function renderCrewContacts(contacts, emptyMessage = 'Crew contact details will be posted soon.') {
  const container = $('#crew-contacts');
  if (!container) return;
  const validContacts = (Array.isArray(contacts) ? contacts : []).slice(0, 100).filter((contact) => {
    return String(contact?.name || '').trim().length >= 2 && String(contact?.role || '').trim().length >= 2 && Boolean(toE164ContactPhone(contact?.phone));
  });
  if (!validContacts.length) {
    const empty = document.createElement('p');
    empty.className = 'contact-empty';
    empty.textContent = emptyMessage;
    container.replaceChildren(empty);
    return;
  }
  const cards = validContacts.map((contact, index) => {
    const name = String(contact.name).trim();
    const role = String(contact.role).trim();
    const e164 = toE164ContactPhone(contact.phone);
    const digitsOnly = normalizePhone(e164);
    const card = document.createElement('article');
    card.className = `contact-person${index === 0 ? ' contact-primary' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = `contact-avatar${index % 2 ? ' avatar-pink' : ''}`;
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = name.charAt(0).toUpperCase();
    const details = document.createElement('span');
    const roleNode = document.createElement('small');
    roleNode.textContent = role;
    const nameNode = document.createElement('strong');
    nameNode.textContent = name;
    const phoneNode = document.createElement('b');
    phoneNode.textContent = formatContactPhone(e164);
    const links = document.createElement('span');
    links.className = 'contact-links';
    const call = document.createElement('a');
    call.href = `tel:${digitsOnly}`;
    call.textContent = 'Call';
    call.setAttribute('aria-label', `Call ${name}`);
    const whatsapp = document.createElement('a');
    whatsapp.href = `https://wa.me/${digitsOnly}`;
    whatsapp.target = '_blank';
    whatsapp.rel = 'noreferrer';
    whatsapp.textContent = 'WhatsApp ↗';
    whatsapp.setAttribute('aria-label', `WhatsApp ${name}`);
    links.append(call, whatsapp);
    details.append(roleNode, nameNode, phoneNode, links);
    const arrow = document.createElement('span');
    arrow.className = 'contact-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    card.append(avatar, details, arrow);
    return card;
  });
  container.replaceChildren(...cards);
}

async function refreshPublicContacts() {
  try {
    const response = await fetch('/api/event-contacts', { cache: 'no-store' });
    if (!response.ok) { renderCrewContacts([], 'Crew contacts are temporarily unavailable.'); return; }
    const result = await response.json();
    if (Array.isArray(result.contacts)) renderCrewContacts(result.contacts, 'No crew contacts have been added yet.');
  } catch {
    renderCrewContacts([], 'Crew contacts are temporarily unavailable.');
  }
}

function formatTimePart(value) { return String(Math.max(0, value)).padStart(2, '0'); }
function updateCountdown() {
  const eventDistance = new Date(SITE_CONFIG.event.date).getTime() - Date.now();
  if (eventDistance <= 0) {
    $$('[data-countdown]').forEach((node) => { node.textContent = '00'; });
    const copy = $('[data-countdown-copy]');
    if (copy) copy.innerHTML = '<strong>THE CURTAIN IS UP.</strong> See you in the crowd.';
    return;
  }
  const totalMinutes = Math.floor(eventDistance / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const values = { days, hours, minutes };
  Object.entries(values).forEach(([key, value]) => {
    const node = $(`[data-countdown="${key}"]`);
    if (node) node.textContent = formatTimePart(value);
  });
}

function showToast(message) {
  const toast = $('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function applyRegistrationState() {
  const closed = isClosed();
  $$('[data-register-cta]').forEach((cta) => {
    if (!closed) return;
    cta.removeAttribute('href');
    cta.setAttribute('aria-disabled', 'true');
    cta.classList.add('is-closed');
    cta.innerHTML = 'Registrations closed <span aria-hidden="true">×</span>';
  });
  $$('[data-form-type]').forEach((form) => {
    const wrap = form.closest('.form-wrap');
    if (!wrap || !closed) return;
    const panel = $('[data-form-panel]', wrap);
    if (panel && !panel.querySelector('.closed-form-message')) {
      panel.innerHTML = `<div class="closed-form-message"><span class="success-sfx">LATE!</span><span class="success-icon">×</span><p class="eyebrow">CASTING CLOSED</p><h3>This panel<br /><span>is locked.</span></h3><p>Registration closed on <strong>${SITE_CONFIG.event.deadlineLabel}</strong>. Follow the event Instagram for updates.</p><a class="button button-light" href="${SITE_CONFIG.contacts.instagram}" target="_blank" rel="noreferrer">Follow event updates ↗</a></div>`;
    }
  });
  if (closed) {
    const copy = $('[data-countdown-copy]');
    if (copy) copy.innerHTML = '<strong>REGISTRATION CLOSED.</strong> Follow the event page for updates.';
  }
}

function setError(field, message) {
  if (!field) return;
  field.setAttribute('aria-invalid', 'true');
  const error = $(`#${field.id}-error`) || $(`#${field.name}-error`) || field.closest('.field')?.querySelector('.field-error');
  if (error) error.textContent = message;
}
function clearError(field) {
  if (!field) return;
  field.removeAttribute('aria-invalid');
  const error = $(`#${field.id}-error`) || $(`#${field.name}-error`) || field.closest('.field')?.querySelector('.field-error');
  if (error) error.textContent = '';
}
function clearFormErrors(form) {
  $$('input, select, textarea', form).forEach(clearError);
  $$('.field-error', form).forEach((node) => { node.textContent = ''; });
}
function field(form, name) { return form.elements[name]; }
function firstItem(item) { return item instanceof RadioNodeList ? item[0] : item; }

function validateContest(form) {
  const errors = [];
  const fullName = field(form, 'fullName');
  const roll = field(form, 'rollNumber');
  const category = field(form, 'category');
  const year = field(form, 'year');
  const phone = field(form, 'phone');
  const consent = field(form, 'consent');
  if (fullName.value.trim().length < 2 || fullName.value.trim().length > 60) errors.push([fullName, 'Oops! Add your full name.']);
  if (!roll.value.trim()) errors.push([roll, 'Oops! Roll number is needed.']);
  if (!form.elements.category.value) errors.push([firstItem(category), 'Pick Mr or Miss Freshers.']);
  if (year.value !== '2nd year') errors.push([year, 'Mr & Miss Freshers is open to second-year students only.']);
  if (normalizePhone(phone.value).length !== 10) errors.push([phone, 'Use exactly 10 digits for WhatsApp.']);
  if (!consent.checked) errors.push([consent, 'Tick the rules box to enter.']);
  errors.forEach(([input, message]) => setError(input, message));
  return errors;
}

function validatePerformance(form) {
  const errors = [];
  const performanceName = field(form, 'performanceName');
  const leadName = field(form, 'leadName');
  const phone = field(form, 'phone');
  const memberCount = field(form, 'memberCount');
  const memberNames = field(form, 'memberNames');
  const type = field(form, 'performanceType');
  const duration = field(form, 'duration');
  const description = field(form, 'description');
  const leadBranchYear = field(form, 'leadBranchYear');
  const consent = field(form, 'consent');
  if (performanceName.value.trim().length < 2 || performanceName.value.trim().length > 60) errors.push([performanceName, 'Give this act a name.']);
  if (leadName.value.trim().length < 2) errors.push([leadName, 'Add the lead contact name.']);
  if (normalizePhone(phone.value).length !== 10) errors.push([phone, 'Use exactly 10 digits for WhatsApp.']);
  if (Number(memberCount.value) < 1 || Number(memberCount.value) > 15) errors.push([memberCount, 'Groups can have 1–15 members.']);
  if (Number(memberCount.value) > 1 && memberNames.value.trim().split('\n').filter(Boolean).length < Number(memberCount.value)) errors.push([memberNames, `Add all ${memberCount.value} member names, one per line.`]);
  if (!type.value) errors.push([type, 'Pick a performance type.']);
  if (Number(duration.value) < 1 || Number(duration.value) > 5) errors.push([duration, 'Keep it between 1 and 5 minutes.']);
  if (description.value.length > 200) errors.push([description, 'Keep it under 200 characters.']);
  if (leadBranchYear.value !== 'Data Science') errors.push([leadBranchYear, 'Department must be Data Science.']);
  if (!consent.checked) errors.push([consent, 'Tick the rules box to enter.']);
  errors.forEach(([input, message]) => setError(input, message));
  return errors;
}

function updateCharacterCount(textarea) {
  const counter = $(`[data-count-for="${textarea.id}"]`);
  if (counter) counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`;
}
function updateMemberField(form) {
  const count = Number(field(form, 'memberCount').value || 1);
  const groupField = $('[data-group-field]', form);
  const requiredMark = $('[data-member-required]', form);
  const helper = $('[data-member-helper]', form);
  if (!groupField) return;
  groupField.dataset.single = count === 1 ? 'true' : 'false';
  field(form, 'memberNames').placeholder = count === 1 ? 'Optional for a solo act' : `Add ${count} member names, one per line`;
  if (requiredMark) requiredMark.hidden = count === 1;
  if (helper) helper.textContent = count === 1 ? 'Optional for solo acts' : 'One name per line for group acts';
}

function getFormValues(form) {
  const values = {};
  new FormData(form).forEach((value, key) => {
    if (key === 'website') return;
    if (key === 'consent') { values[key] = 'Accepted'; return; }
    if (key === 'needs') { values[key] = values[key] ? `${values[key]}, ${value}` : value; return; }
    values[key] = String(value).trim();
  });
  return values;
}
function renderSummary(form, values) {
  const type = form.dataset.formType;
  const summary = form.closest('.form-wrap').querySelector('[data-success-summary]');
  if (!summary) return;
  const chips = type === 'contest'
    ? [values.fullName, values.rollNumber, values.category, values.year]
    : [values.performanceName, values.performanceType, `${values.duration} min`];
  summary.replaceChildren(...chips.filter(Boolean).map((item) => {
    const chip = document.createElement('span');
    chip.className = 'summary-chip';
    chip.textContent = item;
    return chip;
  }));
}
function setSending(form, sending) {
  const button = $('.submit-button', form);
  if (!button) return;
  button.disabled = sending;
  button.querySelector('span').textContent = sending ? 'Sending your entry…' : (form.dataset.formType === 'contest' ? 'Submit my origin story' : 'Save me a stage slot');
}
function setFormState(form, state) {
  const wrap = form.closest('.form-wrap');
  const panel = $('[data-form-panel]', wrap);
  const success = $(`[data-success-panel="${form.dataset.formType}"]`, wrap);
  const failure = $(`[data-failure-panel="${form.dataset.formType}"]`, wrap);
  if (panel) panel.hidden = state !== 'form';
  if (success) success.hidden = state !== 'success';
  if (failure) failure.hidden = state !== 'failure';
}

async function submitRegistration(form, values) {
  const response = await fetch('/api/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: form.dataset.formType, data: values })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || 'Registration could not be saved.');
  return result;
}

function wireForm(form) {
  const type = form.dataset.formType;
  const validator = type === 'contest' ? validateContest : validatePerformance;
  $$('input, textarea, select', form).forEach((input) => {
    input.addEventListener('input', () => clearError(input));
    input.addEventListener('change', () => clearError(input));
  });
  $$('textarea[maxlength]', form).forEach((textarea) => textarea.addEventListener('input', () => updateCharacterCount(textarea)));
  if (type === 'performance') field(form, 'memberCount').addEventListener('input', () => updateMemberField(form));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isClosed()) { showToast('Registration is closed — follow the event page for updates.'); return; }
    clearFormErrors(form);
    if (field(form, 'website')?.value) return;
    const errors = validator(form);
    if (errors.length) {
      firstItem(errors[0][0]).focus();
      return;
    }
    const values = getFormValues(form);
    setSending(form, true);
    let success = false;
    try {
      await submitRegistration(form, values);
      success = true;
    } catch {
      success = false;
    }
    setSending(form, false);
    if (success) {
      renderSummary(form, values);
      setFormState(form, 'success');
      showToast(type === 'contest' ? 'POW! Entry received.' : 'ZAP! Stage request received.');
    } else {
      setFormState(form, 'failure');
    }
  });
}

function wireFormControls() {
  $$('[data-reset]').forEach((button) => button.addEventListener('click', () => {
    const type = button.dataset.reset;
    const form = $(`[data-form-type="${type}"]`);
    form.reset();
    clearFormErrors(form);
    if (type === 'performance') updateMemberField(form);
    setFormState(form, 'form');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  $$('[data-retry]').forEach((button) => button.addEventListener('click', () => {
    const form = $(`[data-form-type="${button.dataset.retry}"]`);
    setFormState(form, 'form');
    form.querySelector('input, select, textarea').focus();
  }));
  $$('[data-fallback-link]').forEach((link) => {
    const key = link.dataset.fallbackLink;
    const viewUrl = SITE_CONFIG.forms[key].viewUrl;
    link.href = viewUrl;
    link.hidden = !viewUrl || viewUrl.includes('DEMO_');
  });
}

function wireAnimations() {
  const targets = $$('.content-section, .feature-section, .stage-section, .timeline-section, .faq-section, .contact-section, .comic-card, .form-wrap, .timeline-item');
  targets.forEach((node) => node.classList.add('reveal'));
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((node) => node.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: .12 });
  targets.forEach((node) => observer.observe(node));
}

function boot() {
  setTextBindings();
  updateCountdown();
  window.setInterval(updateCountdown, 30000);
  applyRegistrationState();
  window.setInterval(applyRegistrationState, 30000);
  $$('form[data-form-type]').forEach(wireForm);
  wireFormControls();
  const performanceForm = $('#performance-form');
  if (performanceForm) updateMemberField(performanceForm);
  $$('textarea[maxlength]').forEach(updateCharacterCount);
  wireAnimations();
}

document.addEventListener('DOMContentLoaded', boot);
