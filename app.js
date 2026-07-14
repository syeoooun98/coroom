// coroom - 회의실 예약 그리드 앱
(function () {
  'use strict';

  const MY_NAME_KEY = 'coroom_my_name';
  const DAY_START_MIN = 9 * 60; // 09:00
  const DAY_END_MIN = 18 * 60; // 18:00
  const SLOT_MINUTES = 30;

  const ROOM_COLOR_CLASS = {
    1: 'room-color-1',
    2: 'room-color-2',
    3: 'room-color-3',
    4: 'room-color-4',
    5: 'room-color-5',
    6: 'room-color-6',
  };

  // ---------- 상태 ----------
  const state = {
    currentDate: startOfDay(new Date()),
    rooms: [],
    reservations: [], // 현재 날짜의 confirmed 예약 목록
    pendingCreate: null, // {roomId, startTime}
    pendingDetail: null, // 선택된 예약 객체
  };

  // ---------- DOM 참조 ----------
  const el = {
    prevDayBtn: document.getElementById('prevDayBtn'),
    todayBtn: document.getElementById('todayBtn'),
    nextDayBtn: document.getElementById('nextDayBtn'),
    currentDateLabel: document.getElementById('currentDateLabel'),
    myNameInput: document.getElementById('myNameInput'),
    statusMessage: document.getElementById('statusMessage'),

    gridHeaderRow: document.getElementById('gridHeaderRow'),
    gridBody: document.getElementById('gridBody'),

    roomTooltip: document.getElementById('roomTooltip'),

    createModal: document.getElementById('createModal'),
    createForm: document.getElementById('createForm'),
    createRoomSelect: document.getElementById('createRoomSelect'),
    createDateLabel: document.getElementById('createDateLabel'),
    createStartTime: document.getElementById('createStartTime'),
    createEndTime: document.getElementById('createEndTime'),
    createReserverName: document.getElementById('createReserverName'),
    createDepartment: document.getElementById('createDepartment'),
    createTitle: document.getElementById('createTitle'),
    createModalError: document.getElementById('createModalError'),
    createCancelBtn: document.getElementById('createCancelBtn'),
    createSubmitBtn: document.getElementById('createSubmitBtn'),

    detailModal: document.getElementById('detailModal'),
    detailRoomName: document.getElementById('detailRoomName'),
    detailReserverName: document.getElementById('detailReserverName'),
    detailDepartment: document.getElementById('detailDepartment'),
    detailTitle: document.getElementById('detailTitle'),
    detailDate: document.getElementById('detailDate'),
    detailTime: document.getElementById('detailTime'),
    detailStatus: document.getElementById('detailStatus'),
    detailCloseBtn: document.getElementById('detailCloseBtn'),
    detailCancelBtn: document.getElementById('detailCancelBtn'),

    identityModal: document.getElementById('identityModal'),
    identityModalMessage: document.getElementById('identityModalMessage'),
    identityYesBtn: document.getElementById('identityYesBtn'),
    identityNoBtn: document.getElementById('identityNoBtn'),

    messageModal: document.getElementById('messageModal'),
    messageModalText: document.getElementById('messageModalText'),
    messageOkBtn: document.getElementById('messageOkBtn'),
  };

  // ---------- 유틸 ----------
  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateLabel(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  }

  function isToday(date) {
    return formatDateISO(date) === formatDateISO(new Date());
  }

  function minutesToTimeStr(min) {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  function timeStrToMinutes(str) {
    // "HH:MM" or "HH:MM:SS"
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  }

  function buildAllTimes() {
    const times = [];
    for (let min = DAY_START_MIN; min <= DAY_END_MIN; min += SLOT_MINUTES) {
      times.push(minutesToTimeStr(min));
    }
    return times;
  }

  const ALL_TIMES = buildAllTimes(); // 09:00 ~ 18:00 (19개)
  const SLOT_TIMES = ALL_TIMES.slice(0, -1); // 09:00 ~ 17:30 (18개, 그리드 행 & 시작시간 후보)

  function nowMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  // ---------- 메시지/상태 표시 ----------
  function showStatusMessage(text) {
    el.statusMessage.textContent = text;
    el.statusMessage.hidden = false;
  }

  function hideStatusMessage() {
    el.statusMessage.hidden = true;
  }

  function showMessageModal(text) {
    el.messageModalText.textContent = text;
    el.messageModal.hidden = false;
  }

  function hideMessageModal() {
    el.messageModal.hidden = true;
  }

  el.messageOkBtn.addEventListener('click', hideMessageModal);

  // ---------- 내 이름 (localStorage) ----------
  function getMyName() {
    return (localStorage.getItem(MY_NAME_KEY) || '').trim();
  }

  function setMyName(name) {
    localStorage.setItem(MY_NAME_KEY, name);
  }

  el.myNameInput.value = getMyName();
  el.myNameInput.addEventListener('input', () => {
    setMyName(el.myNameInput.value.trim());
  });

  // ---------- 데이터 로드 ----------
  async function loadRooms() {
    const { data, error } = await supabaseClient
      .from('rooms')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error(error);
      showStatusMessage('회의실 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
      return [];
    }
    return data || [];
  }

  async function loadReservations(dateStr) {
    const { data, error } = await supabaseClient
      .from('reservations')
      .select('*')
      .eq('reservation_date', dateStr)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true });

    if (error) {
      console.error(error);
      showStatusMessage('예약 정보를 불러오는 중 오류가 발생했습니다: ' + error.message);
      return [];
    }
    return data || [];
  }

  async function refreshReservations() {
    const dateStr = formatDateISO(state.currentDate);
    state.reservations = await loadReservations(dateStr);
    renderGrid();
  }

  // ---------- 그리드 렌더링 ----------
  function renderGridHeader() {
    // 시간 컬럼은 이미 HTML에 존재, 회의실 헤더만 추가
    el.gridHeaderRow.querySelectorAll('.room-header').forEach((th) => th.remove());

    state.rooms.forEach((room) => {
      const th = document.createElement('th');
      th.className = 'room-header';
      th.innerHTML = `
        <div class="room-name">${escapeHtml(room.name)}</div>
        <div class="room-capacity">정원 ${room.capacity}명</div>
      `;
      th.addEventListener('mouseenter', (e) => showRoomTooltip(e, room));
      th.addEventListener('mousemove', (e) => positionRoomTooltip(e));
      th.addEventListener('mouseleave', hideRoomTooltip);
      th.addEventListener('click', (e) => {
        if (el.roomTooltip.hidden) {
          showRoomTooltip(e, room);
        } else {
          hideRoomTooltip();
        }
      });
      el.gridHeaderRow.appendChild(th);
    });
  }

  function showRoomTooltip(e, room) {
    el.roomTooltip.innerHTML = `
      <strong>${escapeHtml(room.name)}</strong><br/>
      층: ${escapeHtml(room.floor || '-')}<br/>
      수용인원: ${room.capacity}명<br/>
      보유장비: ${escapeHtml(room.equipment || '-')}
      ${room.note ? `<br/>비고: ${escapeHtml(room.note)}` : ''}
    `;
    el.roomTooltip.hidden = false;
    positionRoomTooltip(e);
  }

  function positionRoomTooltip(e) {
    el.roomTooltip.style.left = e.pageX + 12 + 'px';
    el.roomTooltip.style.top = e.pageY + 12 + 'px';
  }

  function hideRoomTooltip() {
    el.roomTooltip.hidden = true;
  }

  function reservationsByRoom() {
    const map = {};
    state.rooms.forEach((r) => (map[r.id] = []));
    state.reservations.forEach((res) => {
      if (!map[res.room_id]) map[res.room_id] = [];
      map[res.room_id].push(res);
    });
    return map;
  }

  function renderGrid() {
    renderGridHeader();
    el.gridBody.innerHTML = '';

    const byRoom = reservationsByRoom();
    const today = isToday(state.currentDate);
    const currentMinutes = nowMinutes();

    // 각 회의실 컬럼별로, 이 슬롯 인덱스보다 작은 값까지는 이미 rowspan으로 그려졌음(스킵)
    const occupiedUntil = {};
    state.rooms.forEach((r) => (occupiedUntil[r.id] = -1));

    SLOT_TIMES.forEach((slotTime, rowIndex) => {
      const tr = document.createElement('tr');

      const timeTd = document.createElement('td');
      timeTd.className = 'time-cell';
      timeTd.textContent = slotTime;
      tr.appendChild(timeTd);

      const slotStartMin = timeStrToMinutes(slotTime);

      state.rooms.forEach((room) => {
        if (occupiedUntil[room.id] >= rowIndex) {
          // 이전 예약 셀의 rowspan에 이미 포함됨
          return;
        }

        const roomReservations = byRoom[room.id] || [];
        const startingRes = roomReservations.find(
          (res) => timeStrToMinutes(res.start_time) === slotStartMin
        );

        const td = document.createElement('td');

        if (startingRes) {
          const startMin = timeStrToMinutes(startingRes.start_time);
          const endMin = timeStrToMinutes(startingRes.end_time);
          const span = Math.max(1, Math.round((endMin - startMin) / SLOT_MINUTES));
          occupiedUntil[room.id] = rowIndex + span - 1;

          td.rowSpan = span;
          td.className = `slot-cell reserved ${ROOM_COLOR_CLASS[room.id] || ''}`;
          td.innerHTML = `
            <span class="res-title">${escapeHtml(startingRes.title)}</span>
            <span class="res-name">${escapeHtml(startingRes.reserver_name)}</span>
          `;
          td.addEventListener('click', () => openDetailModal(startingRes, room));
        } else {
          const isPast = today && slotStartMin < currentMinutes;
          if (isPast) {
            td.className = 'slot-cell past';
          } else {
            td.className = 'slot-cell free';
            td.addEventListener('click', () => openCreateModal(room, slotTime));
          }
        }

        tr.appendChild(td);
      });

      el.gridBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------- 날짜 네비게이션 ----------
  function renderDateLabel() {
    el.currentDateLabel.textContent = formatDateLabel(state.currentDate);
  }

  async function changeDate(newDate) {
    state.currentDate = startOfDay(newDate);
    renderDateLabel();
    hideStatusMessage();
    await refreshReservations();
  }

  el.prevDayBtn.addEventListener('click', () => {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() - 1);
    changeDate(d);
  });

  el.nextDayBtn.addEventListener('click', () => {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() + 1);
    changeDate(d);
  });

  el.todayBtn.addEventListener('click', () => {
    changeDate(new Date());
  });

  // ---------- 예약 생성 모달 ----------
  function populateRoomSelect(selectedRoomId) {
    el.createRoomSelect.innerHTML = '';
    state.rooms.forEach((room) => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.textContent = `${room.name} (정원 ${room.capacity}명)`;
      if (room.id === selectedRoomId) opt.selected = true;
      el.createRoomSelect.appendChild(opt);
    });
  }

  function populateStartTimeSelect(selectedTime) {
    el.createStartTime.innerHTML = '';
    SLOT_TIMES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === selectedTime) opt.selected = true;
      el.createStartTime.appendChild(opt);
    });
  }

  function populateEndTimeSelect(startTime, preferredEnd) {
    el.createEndTime.innerHTML = '';
    const startMin = timeStrToMinutes(startTime);
    const candidates = ALL_TIMES.filter((t) => timeStrToMinutes(t) > startMin);
    const defaultEnd = preferredEnd && candidates.includes(preferredEnd)
      ? preferredEnd
      : candidates[0];

    candidates.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === defaultEnd) opt.selected = true;
      el.createEndTime.appendChild(opt);
    });
  }

  el.createStartTime.addEventListener('change', () => {
    populateEndTimeSelect(el.createStartTime.value);
  });

  function openCreateModal(room, startTime) {
    hideCreateModalError();
    state.pendingCreate = { roomId: room.id };

    populateRoomSelect(room.id);
    el.createDateLabel.textContent = formatDateLabel(state.currentDate);
    populateStartTimeSelect(startTime);

    // 기본 종료시간: 시작 + 30분
    const startMin = timeStrToMinutes(startTime);
    const defaultEnd = minutesToTimeStr(startMin + SLOT_MINUTES);
    populateEndTimeSelect(startTime, defaultEnd);

    el.createReserverName.value = getMyName();
    el.createDepartment.value = '';
    el.createTitle.value = '';

    el.createModal.hidden = false;
  }

  function closeCreateModal() {
    el.createModal.hidden = true;
    state.pendingCreate = null;
  }

  function showCreateModalError(text) {
    el.createModalError.textContent = text;
    el.createModalError.hidden = false;
  }

  function hideCreateModalError() {
    el.createModalError.hidden = true;
    el.createModalError.textContent = '';
  }

  el.createCancelBtn.addEventListener('click', closeCreateModal);

  el.createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideCreateModalError();

    const roomId = Number(el.createRoomSelect.value);
    const startTime = el.createStartTime.value;
    const endTime = el.createEndTime.value;
    const reserverName = el.createReserverName.value.trim();
    const department = el.createDepartment.value.trim();
    const title = el.createTitle.value.trim();

    if (!roomId || !startTime || !endTime || !reserverName || !department || !title) {
      showCreateModalError('모든 항목을 입력해주세요.');
      return;
    }

    if (timeStrToMinutes(endTime) <= timeStrToMinutes(startTime)) {
      showCreateModalError('종료시간은 시작시간보다 이후여야 합니다.');
      return;
    }

    el.createSubmitBtn.disabled = true;

    const { error } = await supabaseClient.from('reservations').insert({
      room_id: roomId,
      reserver_name: reserverName,
      department: department,
      title: title,
      reservation_date: formatDateISO(state.currentDate),
      start_time: startTime + ':00',
      end_time: endTime + ':00',
    });

    el.createSubmitBtn.disabled = false;

    if (error) {
      console.error(error);
      if (error.code === '23P01') {
        showCreateModalError('이미 예약된 시간대입니다. 다른 시간을 선택해주세요.');
      } else {
        showCreateModalError('예약 중 오류가 발생했습니다: ' + error.message);
      }
      return;
    }

    closeCreateModal();
    await refreshReservations();
  });

  // ---------- 예약 상세/취소 모달 ----------
  function openDetailModal(reservation, room) {
    state.pendingDetail = reservation;

    el.detailRoomName.textContent = room ? room.name : `회의실 ${reservation.room_id}`;
    el.detailReserverName.textContent = reservation.reserver_name;
    el.detailDepartment.textContent = reservation.department;
    el.detailTitle.textContent = reservation.title;
    el.detailDate.textContent = reservation.reservation_date;
    el.detailTime.textContent = `${reservation.start_time.slice(0, 5)} - ${reservation.end_time.slice(0, 5)}`;
    el.detailStatus.textContent = reservation.status === 'confirmed' ? '확정' : '취소';

    el.detailModal.hidden = false;
  }

  function closeDetailModal() {
    el.detailModal.hidden = true;
    state.pendingDetail = null;
  }

  el.detailCloseBtn.addEventListener('click', closeDetailModal);

  el.detailCancelBtn.addEventListener('click', () => {
    if (!state.pendingDetail) return;
    const reservation = state.pendingDetail;
    const myName = getMyName();

    if (myName && myName === reservation.reserver_name) {
      const confirmed = window.confirm('정말 취소하시겠습니까?');
      if (confirmed) {
        cancelReservation(reservation);
      }
    } else {
      openIdentityModal(reservation);
    }
  });

  async function cancelReservation(reservation) {
    const { error } = await supabaseClient
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation.id);

    if (error) {
      console.error(error);
      showMessageModal('예약 취소 중 오류가 발생했습니다: ' + error.message);
      return;
    }

    closeDetailModal();
    await refreshReservations();
  }

  // ---------- 본인 확인 모달 ----------
  function openIdentityModal(reservation) {
    el.identityModalMessage.textContent = `${reservation.reserver_name}님이 예약하셨습니다. 본인이신가요?`;
    el.identityModal.hidden = false;

    const onYes = () => {
      cleanup();
      closeIdentityModal();
      cancelReservation(reservation);
    };
    const onNo = () => {
      cleanup();
      closeIdentityModal();
      showMessageModal('예약을 취소할 수 없습니다.');
    };

    function cleanup() {
      el.identityYesBtn.removeEventListener('click', onYes);
      el.identityNoBtn.removeEventListener('click', onNo);
    }

    el.identityYesBtn.addEventListener('click', onYes);
    el.identityNoBtn.addEventListener('click', onNo);
  }

  function closeIdentityModal() {
    el.identityModal.hidden = true;
  }

  // ---------- 실시간 반영 ----------
  function subscribeRealtime() {
    supabaseClient
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          refreshReservations();
        }
      )
      .subscribe();
  }

  // ---------- 초기화 ----------
  async function init() {
    renderDateLabel();
    state.rooms = await loadRooms();
    await refreshReservations();
    subscribeRealtime();

    // 자정을 넘기거나 시간이 흘러 과거 슬롯 표시가 갱신되도록 1분마다 다시 그림
    setInterval(() => {
      renderGrid();
    }, 60 * 1000);
  }

  init();
})();
