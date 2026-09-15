const $ = (selector) => document.querySelector(selector);
const landing = $('#landing');
const planner = $('#planner');
const input = $('#eventInput');
const grid = $('#calendarGrid');
const status = $('#status');
const monthHeading = $('#monthHeading');
const now = new Date();
let viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
let events = JSON.parse(localStorage.getItem('five-minute-calendar') || '[]');
const incomingParams = new URLSearchParams(location.search);
const urlTags = new Set((incomingParams.get('tags') || '').split(',').map(decodeURIComponent).filter(Boolean));
const sharedEvents = incomingParams.get('events');
if (sharedEvents) { try { events = JSON.parse(decodeURIComponent(sharedEvents)); } catch { /* keep local events when a link is malformed */ } }

function openPlanner() {
  landing.classList.add('closed');
  planner.classList.add('active');
  planner.setAttribute('aria-hidden', 'false');
  setTimeout(() => input.focus(), 550);
}

function save() { localStorage.setItem('five-minute-calendar', JSON.stringify(events)); }
function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }

function render() {
  monthHeading.textContent = viewDate.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  grid.innerHTML = '';
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - mondayOffset);
  for (let i=0; i<42; i++) {
    const date = new Date(start); date.setDate(start.getDate()+i);
    const key = dateKey(date);
    const cell = document.createElement('div');
    const isOutside = date.getMonth() !== viewDate.getMonth();
    cell.className = 'day' + (isOutside ? ' outside' : '') + (key === dateKey(now) ? ' today' : '');
    cell.innerHTML = isOutside ? '' : `<span class="day-number">${date.getDate()}</span>`;
    if (!isOutside) events.filter(e => e.date === key && (!urlTags.size || urlTags.has(e.title))).forEach(event => {
      const button = document.createElement('button');
      button.className = 'event'; button.type = 'button'; button.title = 'Click to remove';
      button.innerHTML = `${event.time ? `<span class="event-time">${event.time}</span>` : ''}<span>${escapeHTML(event.title)}</span>`;
      button.addEventListener('click', () => {
        if (confirm(`Remove “${event.title}”?`)) { events = events.filter(e => e.id !== event.id); save(); render(); status.textContent = 'Event removed.'; }
      });
      cell.appendChild(button);
    });
    grid.appendChild(cell);
  }
}

function escapeHTML(text) { const d=document.createElement('div'); d.textContent=text; return d.innerHTML; }

function parseEvent(text) {
  const lower = text.toLowerCase();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const namedDay = dayNames.findIndex(day => lower.includes(day));
  const numericDay = lower.match(/(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/);
  const explicitDate = lower.match(/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/);
  if (explicitDate) {
    date = new Date(now.getFullYear(), now.getMonth(), Number(explicitDate[2]));
  } else if (namedDay >= 0) {
    const current = (date.getDay()+7)%7;
    let shift = (namedDay-current+7)%7;
    if (shift===0 && date < now) shift += 7;
    date.setDate(date.getDate()+shift);
    if (date.getMonth() !== now.getMonth()) { date = new Date(now.getFullYear(), now.getMonth(), 1); while(date.getDay()!==namedDay) date.setDate(date.getDate()+1); }
  } else if (numericDay && Number(numericDay[1]) <= 31 && !/(?:am|pm|:)\s*$/.test(numericDay[0])) {
    date.setDate(Number(numericDay[1]));
  }
  const timeMatch = lower.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  let time = '';
  if (timeMatch) time = `${timeMatch[1]}${timeMatch[2] ? ':'+timeMatch[2] : ''}${timeMatch[3]}`;
  let title = text
    .replace(/\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/ig,'')
    .replace(/\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/ig,'')
    .replace(/\b(?:on\s+)?(?:the\s+)?\d{1,2}(?:st|nd|rd|th)\b/ig,'')
    .replace(/\b\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?\b/g,'')
    .replace(/\s*,\s*|\s{2,}/g,' ').trim().replace(/^[,\-\s]+|[,\-\s]+$/g,'');
  return { title:title || text.trim(), date:dateKey(date), time };
}

$('#eventForm').addEventListener('submit', (e) => {
  e.preventDefault(); const text=input.value.trim(); if (!text) return;
  const event=parseEvent(text); event.id=Date.now(); events.push(event); save();
  const addedDate = new Date(`${event.date}T12:00:00`);
  input.value=''; render();
  status.textContent=`Added ${event.title} · ${addedDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}${event.time?' at '+event.time:''}`;
});

$('#enterCalendar').addEventListener('click', openPlanner);
$('#backHome').addEventListener('click', () => { landing.classList.remove('closed'); planner.classList.remove('active'); planner.setAttribute('aria-hidden','true'); });
document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => { input.value=b.dataset.example; input.focus(); }));
const shareDialog = $('#shareDialog');
function getTags() {
  const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-`;
  return [...new Set(events.filter(e => e.date.startsWith(monthPrefix)).map(e => e.title).filter(Boolean))].sort((a,b) => a.localeCompare(b));
}
function renderTagChoices() {
  const tags = getTags();
  $('#tagList').innerHTML = tags.length ? tags.map((tag, i) => `<label class="tag-choice"><input type="checkbox" value="${escapeHTML(tag)}" checked> ${escapeHTML(tag)}</label>`).join('') : '<span class="helper">Add an event first to create shareable tags.</span>';
}
$('#shareButton').addEventListener('click', () => { renderTagChoices(); $('#shareResult').hidden=true; shareDialog.showModal(); });
$('#closeShare').addEventListener('click', () => shareDialog.close());
$('#generateShare').addEventListener('click', () => {
  const selected = [...document.querySelectorAll('#tagList input:checked')].map(el => el.value);
  const url = new URL(location.href); const monthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-`; const visibleEvents = events.filter(e => e.date.startsWith(monthPrefix) && (!selected.length || selected.includes(e.title)));
  url.search = `?tags=${selected.map(encodeURIComponent).join(',')}&events=${encodeURIComponent(JSON.stringify(visibleEvents))}`;
  $('#shareUrl').value = url.href; $('#shareResult').hidden=false;
});
$('#copyShare').addEventListener('click', async () => { const button=$('#copyShare'); try { await navigator.clipboard.writeText($('#shareUrl').value); button.textContent='Copied!'; setTimeout(()=>button.textContent='Copy URL',1500); } catch { $('#shareUrl').select(); button.textContent='Select & copy'; } });
function updateClock() { $('#clock').textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); }
function checkMonthChange() {
  const current = new Date();
  if (current.getMonth() !== viewDate.getMonth() || current.getFullYear() !== viewDate.getFullYear()) {
    viewDate = new Date(current.getFullYear(), current.getMonth(), 1);
    render();
  }
}
updateClock(); setInterval(updateClock,30000); setInterval(checkMonthChange,60000); render();
