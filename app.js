/* 한국 2026년 10월 — 가볼 곳
   플레인 JS. 빌드 없음. 데이터는 data/places.json 하나. */

const TYPE_LABELS = { restaurant: '음식점', cafe: '카페', entertainment: '놀거리' };
const TYPE_ICONS  = { restaurant: '🍜', cafe: '☕', entertainment: '🎡' };
const DAY_KEYS    = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS  = { mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토', sun: '일' };
const RADIUS_KM   = [0.5, 1, 2, 5, 10, 20];
const TRIP_START  = '2026-10-01';
const TRIP_END    = '2026-10-31';
const SEOUL       = [37.5665, 126.9780];

const filters = {
  types: [],
  cities: [],
  startDate: '',
  endDate: '',
  useRadius: false,
  center: null,      // [lat, lng]
  radiusKm: 2
};

let places = [];
let visible = [];
let activeId = null;
let pickingCenter = false;

let map, markerLayer, radiusCircle, centerDot;
const markersById = new Map();

const $ = (id) => document.getElementById(id);
const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

/* ---- 유틸 ------------------------------------------------------------ */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatMonthDay(dateKey) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

function formatDateRange(place) {
  if (!place.startDate && !place.endDate) return '상설';
  if (!place.endDate) return `${formatMonthDay(place.startDate)}부터`;
  if (!place.startDate) return `${formatMonthDay(place.endDate)}까지`;
  return `${formatMonthDay(place.startDate)} – ${formatMonthDay(place.endDate)}`;
}

function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

/* 게시물에 주소가 없던 곳은 좌표가 비어 있다. 목록에는 나오지만 지도에는 못 찍는다. */
function hasCoords(place) {
  return typeof place.lat === 'number' && typeof place.lng === 'number';
}

/* ---- 오늘 상태 -------------------------------------------------------- */

function todayStatus(place, now = new Date()) {
  const today = toDateKey(now);

  if (place.endDate && place.endDate < today) return { text: '종료됨', tone: 'ended' };
  if (place.startDate && place.startDate > today) {
    return { text: `${formatMonthDay(place.startDate)} 오픈 예정`, tone: 'upcoming' };
  }
  if (!place.hours) return { text: '영업시간 정보 없음', tone: 'unknown' };

  const todayHours = place.hours[DAY_KEYS[now.getDay()]];
  if (!todayHours) return { text: '오늘 휴무', tone: 'closed' };

  const [open, close] = todayHours;
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const overnight = close <= open;
  const isOpen = overnight ? (nowHm >= open || nowHm < close) : (nowHm >= open && nowHm < close);

  if (isOpen) return { text: `영업 중 · ${close}까지`, tone: 'open' };
  if (nowHm < open) return { text: `오늘 ${open} 오픈`, tone: 'upcoming' };
  return { text: '오늘 영업 종료', tone: 'closed' };
}

/* ---- 필터 ------------------------------------------------------------ */

function overlapsDateRange(place) {
  if (!filters.startDate && !filters.endDate) return true;
  const from = filters.startDate || '0000-01-01';
  const to = filters.endDate || '9999-12-31';
  const placeStart = place.startDate || '0000-01-01';
  const placeEnd = place.endDate || '9999-12-31';
  return placeStart <= to && placeEnd >= from;
}

function matchesFilters(place) {
  if (filters.types.length && !filters.types.includes(place.type)) return false;
  if (filters.cities.length && !filters.cities.includes(place.city)) return false;
  if (!overlapsDateRange(place)) return false;
  if (filters.useRadius && filters.center) {
    if (!hasCoords(place)) return false;
    if (haversineKm(filters.center, [place.lat, place.lng]) > filters.radiusKm) return false;
  }
  return true;
}

function activeFilterCount() {
  let count = 0;
  if (filters.types.length) count += 1;
  if (filters.cities.length) count += 1;
  if (filters.startDate || filters.endDate) count += 1;
  if (filters.useRadius && filters.center) count += 1;
  return count;
}

/* ---- 카드 ------------------------------------------------------------ */

function mapLinks(place) {
  const name = encodeURIComponent(place.name);
  return [
    place.instagram && { href: place.instagram, label: '인스타 게시물', cls: 'ig' },
    hasCoords(place) && {
      href: `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`,
      label: '구글맵', cls: ''
    },
    { href: `https://map.naver.com/p/search/${name}`, label: '네이버', cls: '' },
    hasCoords(place) && {
      href: `https://map.kakao.com/link/to/${name},${place.lat},${place.lng}`,
      label: '카카오', cls: ''
    }
  ].filter(Boolean);
}

function hoursTable(place) {
  if (!place.hours) return '';
  const rows = Object.keys(DAY_LABELS).map((day) => {
    const value = place.hours[day];
    const text = value ? `${value[0]} – ${value[1]}` : '휴무';
    return `<tr><td>${DAY_LABELS[day]}</td><td>${text}</td></tr>`;
  }).join('');
  const note = place.hoursNote ? `<p class="muted">${escapeHtml(place.hoursNote)}</p>` : '';
  return `<details class="hours-all"><summary>영업시간 전체</summary><table>${rows}</table>${note}</details>`;
}

function cardHtml(place) {
  const status = todayStatus(place);
  const thumb = place.image
    ? `<img src="${escapeHtml(place.image)}" alt="" loading="lazy">`
    : `<span aria-hidden="true">${TYPE_ICONS[place.type] || '📍'}</span>`;

  const where = [place.city, place.area].filter(Boolean).join(' · ');
  const meta = [
    `<li><b>기간</b>${escapeHtml(formatDateRange(place))}</li>`,
    `<li><b>위치</b>${escapeHtml(place.address || where)}${hasCoords(place) ? '' : ' <span class="muted">(지도 표시 안 됨)</span>'}</li>`,
    place.price ? `<li><b>가격</b>${escapeHtml(place.price)}</li>` : '',
    place.distanceKm != null ? `<li><b>거리</b>${formatDistance(place.distanceKm)}</li>` : ''
  ].join('');

  const links = mapLinks(place)
    .map((l) => `<a class="${l.cls}" href="${escapeHtml(l.href)}" target="_blank" rel="noopener">${l.label}</a>`)
    .join('');

  return `
    <article class="card" data-id="${escapeHtml(place.id)}" tabindex="0">
      <div class="card-thumb">${thumb}</div>
      <div class="card-body">
        <div class="card-top">
          <span class="tag">${TYPE_LABELS[place.type] || place.type}</span>
          <span class="status" data-tone="${status.tone}">${escapeHtml(status.text)}</span>
        </div>
        <h3>${escapeHtml(place.name)}</h3>
        ${place.description ? `<p class="desc">${escapeHtml(place.description)}</p>` : ''}
        <ul class="meta">${meta}</ul>
        ${hoursTable(place)}
        <div class="links">${links}</div>
      </div>
    </article>`;
}

/* ---- 렌더 ------------------------------------------------------------ */

function renderList() {
  const list = $('list');

  if (!visible.length) {
    list.innerHTML = `
      <div class="state">
        <p>조건에 맞는 장소가 없어요.</p>
        <button type="button" class="btn btn-ghost" data-reset>필터 초기화</button>
      </div>`;
    return;
  }
  list.innerHTML = visible.map(cardHtml).join('');
  addMoreButtons();
}

/* 설명이 2줄을 넘길 때만 더보기 버튼을 붙인다. 짧은 설명에는 버튼이 없다. */
function addMoreButtons() {
  $('list').querySelectorAll('.desc').forEach((desc) => {
    if (desc.scrollHeight - desc.clientHeight < 2) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'more';
    button.textContent = '더보기';
    desc.after(button);
  });
}

function renderMarkers() {
  markerLayer.clearLayers();
  markersById.clear();

  visible.filter(hasCoords).forEach((place) => {
    const marker = L.marker([place.lat, place.lng], {
      icon: L.divIcon({
        className: '',
        html: `<div class="pin" data-type="${place.type}"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -24]
      }),
      title: place.name
    });

    marker.bindPopup(`
      <div class="popup">
        <h3>${escapeHtml(place.name)}</h3>
        <p>${TYPE_LABELS[place.type] || place.type} · ${escapeHtml(formatDateRange(place))}</p>
      </div>`);

    marker.on('click', () => {
      setActive(place.id, { from: 'map' });
    });

    marker.addTo(markerLayer);
    markersById.set(place.id, marker);
  });
}

function renderCount() {
  $('count').innerHTML = visible.length === places.length
    ? `${places.length}곳`
    : `${visible.length}곳 <em>/ 전체 ${places.length}곳</em>`;

  const badge = $('filterBadge');
  const count = activeFilterCount();
  badge.textContent = count;
  badge.hidden = count === 0;
}

/* 모바일에서는 시트가 지도 아래쪽을 가리므로 그만큼 여백을 준다. */
function fitOptions(maxZoom) {
  const bottom = isMobile() ? Math.max(24, window.innerHeight - snapY(snapPoint) + 16) : 40;
  return { paddingTopLeft: [32, 32], paddingBottomRight: [32, bottom], maxZoom };
}

function fitToVisible() {
  if (filters.useRadius && filters.center && radiusCircle) {
    map.fitBounds(radiusCircle.getBounds(), fitOptions(16));
    return;
  }
  const onMap = visible.filter(hasCoords);
  if (!onMap.length) return;
  map.fitBounds(L.latLngBounds(onMap.map((p) => [p.lat, p.lng])), fitOptions(15));
}

function applyFilters({ refit = true } = {}) {
  visible = places.filter(matchesFilters);

  if (filters.useRadius && filters.center) {
    visible.forEach((p) => { p.distanceKm = haversineKm(filters.center, [p.lat, p.lng]); });
    visible.sort((a, b) => a.distanceKm - b.distanceKm);
  } else {
    visible.forEach((p) => { delete p.distanceKm; });
  }

  renderCount();
  renderList();
  renderMarkers();
  if (refit) fitToVisible();
  if (activeId && !visible.some((p) => p.id === activeId)) activeId = null;
}

/* ---- 카드 ↔ 핀 -------------------------------------------------------- */

function setActive(id, { from }) {
  activeId = id;

  document.querySelectorAll('.card').forEach((card) => {
    card.classList.toggle('is-active', card.dataset.id === id);
  });

  const place = visible.find((p) => p.id === id);
  const marker = markersById.get(id);
  if (!place || !marker) return;

  markersById.forEach((otherMarker, otherId) => {
    const pin = otherMarker.getElement()?.querySelector('.pin');
    if (pin) pin.classList.toggle('is-active', otherId === id);
  });

  if (from === 'list') {
    if (isMobile()) setSnap('peek');
    map.setView([place.lat, place.lng], Math.max(map.getZoom(), 15), { animate: true });
    marker.openPopup();
  } else {
    if (isMobile()) {
      setSnap('half');
      keepMarkerAboveSheet(place);
    }
    scrollCardIntoList(id);
  }
}

/* scrollIntoView는 .app까지 같이 스크롤해서 화면 전체가 밀린다. 목록만 직접 스크롤한다. */
function scrollCardIntoList(id) {
  const list = $('list');
  const card = list.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  list.scrollTo({ top: card.offsetTop - list.offsetTop - 8, behavior: 'smooth' });
}

/* 핀을 누르면 시트가 올라와 그 핀을 덮을 수 있다. 덮이면 시트 위 보이는 영역 가운데로 지도를 민다. */
function keepMarkerAboveSheet(place) {
  const pinY = map.latLngToContainerPoint([place.lat, place.lng]).y;
  const sheetTop = snapY(snapPoint);
  if (pinY < sheetTop - 60) return;
  map.panBy([0, pinY - sheetTop / 2]);
}

/* ---- 바텀 시트 -------------------------------------------------------- */

let snapPoint = 'half';
let sheetDragging = false;

/* 시트 윗변의 y 위치(px). peek은 헤더만 남기고 지도를 최대한 보여준다. */
function snapY(point) {
  if (point === 'full') return window.innerHeight * 0.08;
  if (point === 'half') return window.innerHeight * 0.45;
  return window.innerHeight - $('panelGrip').offsetHeight - 20;
}

function setSnap(point) {
  snapPoint = point;
  const panel = $('panel');
  const list = $('list');
  panel.dataset.snap = point;

  if (!isMobile()) {
    panel.style.transform = '';
    list.style.paddingBottom = '';
    return;
  }
  const y = snapY(point);
  panel.style.transform = `translateY(${y}px)`;
  // 시트가 화면 아래로 y만큼 밀려나 있으니, 마지막 카드까지 스크롤되게 그만큼 여백을 준다.
  list.style.paddingBottom = `${y + 24}px`;
}

/* 끌어서 놓으면 끈 방향에 있는 가장 가까운 멈춤 지점으로 간다. 조금만 끌어도 방향대로 움직인다. */
function snapAfterDrag(releaseY, moved) {
  const topToBottom = ['full', 'half', 'peek'];
  if (moved > 0) return topToBottom.find((point) => snapY(point) >= releaseY) || 'peek';
  return [...topToBottom].reverse().find((point) => snapY(point) <= releaseY) || 'full';
}

function initSheet() {
  const panel = $('panel');
  const grip = $('panelGrip');
  const list = $('list');
  setSnap('half');

  let startY = 0;
  let startTranslate = 0;
  let moved = 0;

  function clampY(y) {
    return Math.min(Math.max(y, snapY('full')), snapY('peek'));
  }

  function beginDrag(clientY) {
    sheetDragging = true;
    moved = 0;
    startY = clientY;
    // 애니메이션 도중에 잡아도 튀지 않게, 지금 화면에 보이는 위치에서 시작한다.
    startTranslate = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42;
    panel.classList.add('dragging');
    panel.style.transform = `translateY(${startTranslate}px)`;
  }

  function moveDrag(clientY) {
    moved = clientY - startY;
    panel.style.transform = `translateY(${clampY(startTranslate + moved)}px)`;
  }

  function endDrag(allowTap) {
    sheetDragging = false;
    panel.classList.remove('dragging');

    if (Math.abs(moved) < 6) {
      if (!allowTap) { setSnap(snapPoint); return; }
      // 탭: 반쯤 열려 있으면 내리고, 끝까지 내려가 있거나 올라가 있으면 반으로.
      if (snapPoint === 'half') setSnap('peek');
      else setSnap('half');
      return;
    }
    setSnap(snapAfterDrag(clampY(startTranslate + moved), moved));
  }

  grip.addEventListener('pointerdown', (event) => {
    if (!isMobile()) return;
    if (event.target.closest('button')) return;   // 필터 버튼은 그냥 눌리게 둔다
    beginDrag(event.clientY);
    grip.setPointerCapture(event.pointerId);
  });
  grip.addEventListener('pointermove', (event) => {
    if (sheetDragging) moveDrag(event.clientY);
  });
  grip.addEventListener('pointerup', () => {
    if (sheetDragging) endDrag(true);
  });
  grip.addEventListener('pointercancel', () => {
    if (sheetDragging) endDrag(false);
  });

  // 목록이 맨 위까지 올라가 있을 때 아래로 끌면, 스크롤 대신 시트를 내린다.
  let listTouchStartY = null;

  list.addEventListener('touchstart', (event) => {
    const atTop = list.scrollTop <= 0;
    listTouchStartY = isMobile() && atTop && event.touches.length === 1 ? event.touches[0].clientY : null;
  }, { passive: true });

  list.addEventListener('touchmove', (event) => {
    if (listTouchStartY === null) return;
    const y = event.touches[0].clientY;
    const pulledDown = y - listTouchStartY;

    if (!sheetDragging) {
      if (pulledDown < 0) { listTouchStartY = null; return; }   // 위로 밀면 평소처럼 스크롤
      event.preventDefault();
      if (pulledDown < 8) return;
      beginDrag(listTouchStartY);
    }
    event.preventDefault();
    moveDrag(y);
  }, { passive: false });

  const endListTouch = () => {
    listTouchStartY = null;
    if (sheetDragging) endDrag(false);
  };
  list.addEventListener('touchend', endListTouch);
  list.addEventListener('touchcancel', endListTouch);
}

/* ---- 지도 ------------------------------------------------------------ */

function initMap() {
  // fadeAnimation: 백그라운드 탭에서 타일이 투명하게 멈추는 걸 막는다.
  map = L.map('map', { zoomControl: false, fadeAnimation: false }).setView(SEOUL, 11);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  // 백그라운드 탭에서 열면 컨테이너가 0px이라 첫 fitBounds가 빗나간다.
  // 실제 크기가 잡히는 첫 순간에 한 번만 다시 맞춘다.
  let hasSize = false;
  new ResizeObserver(() => {
    if (hasSize || !map.getContainer().clientWidth) return;
    hasSize = true;
    map.invalidateSize();
    fitToVisible();
  }).observe(map.getContainer());

  placeAttribution();

  map.on('click', (event) => {
    if (pickingCenter) {
      setCenter([event.latlng.lat, event.latlng.lng], '지도에서 고른 지점');
      stopPicking();
      return;
    }
    // 모바일에서 빈 지도를 누르면 시트를 내려 지도를 넓게 보여준다.
    if (isMobile()) setSnap('peek');
  });
}

/* 모바일에서는 오른쪽 아래가 시트에 가려지니 출처 표시를 왼쪽 위로 옮긴다. */
function placeAttribution() {
  map.attributionControl.setPosition(isMobile() ? 'topleft' : 'bottomright');
}

function drawCenter() {
  if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
  if (centerDot) { map.removeLayer(centerDot); centerDot = null; }
  if (!filters.useRadius || !filters.center) return;

  radiusCircle = L.circle(filters.center, {
    radius: filters.radiusKm * 1000,
    color: '#2f5eea', weight: 1, fillColor: '#2f5eea', fillOpacity: 0.08
  }).addTo(map);

  centerDot = L.circleMarker(filters.center, {
    radius: 6, color: '#fff', weight: 2, fillColor: '#2f5eea', fillOpacity: 1
  }).addTo(map);
}

function setCenter(latlng, label) {
  filters.center = latlng;
  filters.useRadius = true;
  $('radiusToggle').checked = true;
  $('radiusBody').hidden = false;
  $('centerLabel').textContent = `기준점: ${label}`;
  drawCenter();
  applyFilters();
}

function startPicking() {
  pickingCenter = true;
  document.body.classList.add('picking');
  $('pickHint').hidden = false;
  closeFilters();
  if (isMobile()) setSnap('peek');
}

function stopPicking() {
  pickingCenter = false;
  document.body.classList.remove('picking');
  $('pickHint').hidden = true;
}

/* ---- 필터 UI --------------------------------------------------------- */

function chipButton(label, value, group) {
  return `<button type="button" class="chip" data-group="${group}" data-value="${escapeHtml(value)}" aria-pressed="false">${escapeHtml(label)}</button>`;
}

function buildFilterChips() {
  $('typeChips').innerHTML = Object.entries(TYPE_LABELS)
    .map(([value, label]) => chipButton(label, value, 'types')).join('');

  const cities = [...new Set(places.map((p) => p.city).filter(Boolean))].sort();
  $('cityChips').innerHTML = cities.map((city) => chipButton(city, city, 'cities')).join('');
}

function syncChips() {
  document.querySelectorAll('.chip[data-group]').forEach((chip) => {
    const on = filters[chip.dataset.group].includes(chip.dataset.value);
    chip.setAttribute('aria-pressed', String(on));
  });
}

function openFilters() {
  document.body.classList.add('filters-open');
  $('scrim').hidden = false;
}

function closeFilters() {
  document.body.classList.remove('filters-open');
  $('scrim').hidden = true;
}

function resetFilters() {
  filters.types = [];
  filters.cities = [];
  filters.startDate = '';
  filters.endDate = '';
  filters.useRadius = false;
  filters.center = null;

  $('startDate').value = '';
  $('endDate').value = '';
  $('radiusToggle').checked = false;
  $('radiusBody').hidden = true;
  $('centerLabel').textContent = '기준점이 아직 없어요.';
  syncChips();
  drawCenter();
  applyFilters();
}

function bindFilterEvents() {
  document.addEventListener('click', (event) => {
    const chip = event.target.closest('.chip[data-group]');
    if (chip) {
      const group = filters[chip.dataset.group];
      const value = chip.dataset.value;
      const index = group.indexOf(value);
      if (index === -1) group.push(value); else group.splice(index, 1);
      syncChips();
      applyFilters();
      return;
    }

    if (event.target.closest('[data-reset]')) { resetFilters(); return; }

    const more = event.target.closest('.more');
    if (more) {
      const desc = more.previousElementSibling;
      const expanded = desc.classList.toggle('expanded');
      more.textContent = expanded ? '접기' : '더보기';
      return;
    }

    const card = event.target.closest('.card');
    if (card && !event.target.closest('a, button, summary')) {
      setActive(card.dataset.id, { from: 'list' });
    }
  });

  $('list').addEventListener('keydown', (event) => {
    const card = event.target.closest('.card');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setActive(card.dataset.id, { from: 'list' });
    }
  });

  $('startDate').addEventListener('change', (e) => { filters.startDate = e.target.value; applyFilters(); });
  $('endDate').addEventListener('change', (e) => { filters.endDate = e.target.value; applyFilters(); });

  $('presetTrip').addEventListener('click', () => {
    filters.startDate = TRIP_START;
    filters.endDate = TRIP_END;
    $('startDate').value = TRIP_START;
    $('endDate').value = TRIP_END;
    applyFilters();
  });

  $('presetToday').addEventListener('click', () => {
    const today = toDateKey(new Date());
    filters.startDate = today;
    filters.endDate = today;
    $('startDate').value = today;
    $('endDate').value = today;
    applyFilters();
  });

  $('radiusToggle').addEventListener('change', (e) => {
    filters.useRadius = e.target.checked;
    $('radiusBody').hidden = !e.target.checked;
    drawCenter();
    applyFilters();
  });

  $('radiusRange').addEventListener('input', (e) => {
    filters.radiusKm = RADIUS_KM[Number(e.target.value)];
    $('radiusOut').textContent = `${filters.radiusKm}km`;
    drawCenter();
    applyFilters();
  });

  $('useMyLocation').addEventListener('click', () => {
    if (!navigator.geolocation) {
      $('centerLabel').textContent = '이 브라우저는 위치 기능을 지원하지 않아요. 지도에서 직접 골라주세요.';
      return;
    }
    $('centerLabel').textContent = '위치를 찾는 중…';
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude], '내 위치'),
      () => { $('centerLabel').textContent = '위치를 가져오지 못했어요. 지도에서 직접 골라주세요.'; },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  $('pickOnMap').addEventListener('click', startPicking);
  $('pickCancel').addEventListener('click', stopPicking);
  $('openFilters').addEventListener('click', openFilters);
  $('closeFilters').addEventListener('click', closeFilters);
  $('applyFilters').addEventListener('click', closeFilters);
  $('resetFilters').addEventListener('click', resetFilters);
  $('scrim').addEventListener('click', closeFilters);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (pickingCenter) stopPicking();
    else closeFilters();
  });

  window.addEventListener('resize', () => {
    // 모바일 주소창이 접히며 생기는 resize가 끄는 도중의 시트를 되돌리지 않게 한다.
    if (!sheetDragging) setSnap(snapPoint);
    placeAttribution();
    map.invalidateSize();
  });
}

/* ---- 시작 ------------------------------------------------------------ */

function showSkeletons() {
  $('list').innerHTML = '<div class="skeleton"></div>'.repeat(4);
}

async function start() {
  initMap();
  initSheet();
  bindFilterEvents();
  showSkeletons();

  try {
    const response = await fetch('data/places.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(response.status);
    places = await response.json();
  } catch (error) {
    $('count').textContent = '불러오기 실패';
    $('list').innerHTML = `
      <div class="state">
        <p>데이터를 불러오지 못했어요.<br>새로고침해 보세요.</p>
      </div>`;
    return;
  }

  buildFilterChips();
  $('radiusRange').value = RADIUS_KM.indexOf(filters.radiusKm);
  $('radiusOut').textContent = `${filters.radiusKm}km`;
  map.invalidateSize();   // fitBounds 전에 실제 크기를 잡아야 한다
  applyFilters();
}

start();
