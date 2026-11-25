// Gentle daily prompts (shown as guidance only, never inserted into the diary).
// Lines for the cheering message. Sayings are traditional Korean proverbs or our own words (no attributed quotes).
const CHEER_LINES = {
  invite: [
    '오늘 하루는 어땠나요? 한 줄이면 충분해요.',
    '오늘 가장 오래 머문 장면 하나를 적어 볼까요?',
    '잘한 일이 없어도 괜찮아요. 있었던 일만 적어도 일기가 돼요.',
    '오늘 들은 말 중에 마음에 남은 한마디가 있나요?',
    '지금 떠오르는 기분을 그대로 적어 보세요.',
    '내년의 내가 오늘을 궁금해할 거예요.',
    '먹은 것, 본 것, 만난 사람. 하나만 골라 적어 봐요.',
    '별일 없던 하루도 적어 두면 특별해져요.'
  ],
  praise: [
    '오늘도 하루를 끝까지 지나왔어요. 정말 수고했어요.',
    '오늘을 적어 둔 것만으로도 충분히 잘한 하루예요.',
    '서툴렀던 순간까지 기록한 당신, 멋져요.',
    '오늘의 기록이 내년의 나에게 좋은 선물이 될 거예요.',
    '작은 일도 놓치지 않고 적었네요. 잘했어요.',
    '힘든 날이었다면, 그래도 버텨 낸 오늘을 칭찬해요.',
    '오늘 하루 애썼어요. 이제 푹 쉬어요.',
    '하루를 돌아볼 줄 아는 당신은 이미 잘하고 있어요.'
  ],
  saying: [
    '천 리 길도 한 걸음부터. (속담)',
    '티끌 모아 태산. (속담)',
    '비 온 뒤에 땅이 굳어진다. (속담)',
    '쥐구멍에도 볕 들 날 있다. (속담)',
    '시작이 반이다. (속담)',
    '오늘의 작은 기록이 내일의 큰 추억이 돼요.',
    '느려도 괜찮아요. 멈추지 않으면 앞으로 가는 거예요.',
    '같은 날을 세 번 지나면, 달라진 나를 만나게 돼요.'
  ]
};

const DAILY_QUESTIONS = [
  '오늘 가장 오래 머문 장소는 어디였나요?',
  '오늘 누군가에게 고마웠던 순간이 있었나요?',
  '오늘 처음 해 본 일이 있다면 무엇인가요?',
  '오늘 들은 말 중 기억에 남는 한마디는?',
  '오늘 먹은 것 중 가장 기억나는 음식은?',
  '오늘 하루를 한 장면으로 남긴다면 어떤 모습일까요?',
  '오늘 미뤄 둔 일과 해낸 일은 무엇인가요?',
  '요즘 자주 떠올리는 사람은 누구인가요?',
  '오늘 창밖이나 길에서 본 것 중 기억나는 것은?',
  '오늘 나를 웃게 한 일이 있었나요?',
  '오늘 배운 것이나 새로 알게 된 것은?',
  '오늘 가장 조용했던 순간은 언제였나요?',
  '지금 가장 기다리고 있는 일은 무엇인가요?',
  '오늘 들었던 노래나 소리가 있나요?',
  '오늘 내가 나에게 해 주고 싶은 말은?',
  '오늘 걸었던 길은 어땠나요?',
  '요즘 아끼는 물건 하나를 꼽는다면?',
  '오늘 누구와 가장 많이 이야기했나요?',
  '오늘 날씨는 내 하루에 어떤 영향을 줬나요?',
  '1년 뒤의 내가 오늘을 기억한다면 무엇일까요?',
  '오늘 예상과 다르게 흘러간 일이 있었나요?',
  '오늘 손으로 한 일 중 기억나는 것은?',
  '요즘 마음에 걸리는 일이 있다면 무엇인가요?',
  '오늘 가장 편안했던 시간은 언제였나요?',
  '오늘 읽거나 본 것 중 떠오르는 것은?',
  '오늘 나는 어떤 결정을 했나요?',
  '오늘 누군가를 도왔거나 도움을 받았나요?',
  '오늘 하루의 시작은 어땠나요?',
  '오늘 하루의 끝은 어땠나요?',
  '지금 내 책상이나 방에는 무엇이 보이나요?',
  '오늘을 한 단어로 적는다면 무엇인가요?'
];

class DiaryApp {
  constructor() {
    this.startYear = 2024;
    this.selectedYear = 2024;
    this.selectedMonth = 10;
    this.selectedDate = 17;
    this.dirtyFlags = {};
    this.requestInProgress = false;
    this.requestGenerations = {};
    this.unsavedData = {};
    this.draftConflicts = {};
    this.entries = {};
    this.imageConfigured = false;
    this.init();
  }

  async init() {
    const today = this.koreanToday();
    document.getElementById('select-start-year').replaceChildren(...Array.from({length:198}, (_, i) => new Option(`${1900+i} — ${1902+i}`, 1900+i)));
    await this.loadSettings();
    
    this.selectedMonth = today.getMonth();
    this.selectedDate = today.getDate();
    this.selectedYear = this.getBaseYear(today);
    
    this.setupEventListeners();
    this.renderCalendar();
    this.updateDateDisplay();
    this.renderDiarySections();
    this.loadDiarySections();
    
    window.addEventListener('beforeunload', (e) => {
      if (this.hasPendingChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  async loadSettings() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');
      const data = await response.json();
      this.startYear = data.start_year || 2024;
      this.imageConfigured = data.image_api && data.image_api.configured === true;
      const consent = document.getElementById('image-consent');
      consent.disabled = !this.imageConfigured;
      document.getElementById('image-api-status').textContent = this.imageConfigured
        ? '키가 설정되어 있어요. 실제 연결은 첫 생성 때 확인합니다.'
        : '학교 API 키를 로컬 설정 파일에 입력해 주세요. 일기 저장은 연결 없이도 가능합니다.';
      this.setupMusic(data.music);
      this.setupNarration(data.narration);
      this.videoInfo = data.video_api || null;
      this.updateStartYearSelect();
    } catch (error) {
      console.error('Settings load error:', error);
      this.startYear = 2024;
    }
  }

  // No music picker: shorts use the server's default track, whose required credit (CC BY) is still shown.
  setupMusic(music) {
    if (!music || !Array.isArray(music.tracks)) return;
    this.musicTracks = Object.fromEntries(music.tracks.map(track => [track.id, track]));
    const credit = document.getElementById('shorts-music-credit');
    if (credit) credit.textContent = this.musicCredit(music.default);
  }

  // Narration options appear only when the local voice model is installed (never in the online demo).
  setupNarration(info) {
    this.narrationAvailable = !!info && info.available === true;
    this.narrationCredit = this.narrationAvailable && typeof info.credit === 'string' ? info.credit : '';
    const options = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('.narration-option') : [];
    for (const option of options) option.hidden = !this.narrationAvailable;
  }

  wantsNarration(id) {
    const box = document.getElementById(id);
    return this.narrationAvailable === true && !!box && box.checked === true;
  }

  musicCredit(id) {
    const track = this.musicTracks && this.musicTracks[id];
    return track ? `음악: ${track.credit}` : '';
  }

  selectedMusic(id) {
    const select = document.getElementById(id);
    return select && select.value ? select.value : undefined;
  }

  updateStartYearSelect() {
    const select = document.getElementById('select-start-year');
    select.value = this.startYear.toString();
  }

  setupEventListeners() {
    const threeYear = document.getElementById('three-year-video');
    if (threeYear) threeYear.addEventListener('click', () => this.makeThreeYearVideo());
    document.getElementById('past-banner-read').addEventListener('click', () => this.readPastEntry());
    const savedShorts = document.getElementById('btn-saved-shorts');
    if (savedShorts) savedShorts.addEventListener('click', () => this.showSavedVideos());
    document.getElementById('close-videos').addEventListener('click', () => document.getElementById('dialog-videos').close());
    document.getElementById('dialog-videos').addEventListener('close', () => document.querySelectorAll('#saved-videos video').forEach(v => v.pause()));
    const aiVideo = document.getElementById('shorts-ai-video');
    if (aiVideo) aiVideo.addEventListener('change', () => this.updateClipCost());
    document.getElementById('calendar-year').addEventListener('change', (event) => {
      this.selectedYear = Number(event.target.value);
      this.renderCalendar();
    });
    document.getElementById('dialog-shorts').addEventListener('close', () => document.getElementById('shorts-video').pause());
    document.getElementById('retry-story').addEventListener('click', () => this.prepareShortsStory());
    document.getElementById('shorts-captions').addEventListener('input', () => this.renderShortsStory());
    const spokenBox = document.getElementById('shorts-spoken');
    if (spokenBox) spokenBox.addEventListener('input', () => this.renderStoryList());
    document.getElementById('make-shorts').addEventListener('click', () => this.makeShorts());
    document.getElementById('close-shorts').addEventListener('click', () => document.getElementById('dialog-shorts').close());
    document.getElementById('btn-prev-month').addEventListener('click', () => this.previousMonth());
    document.getElementById('btn-next-month').addEventListener('click', () => this.nextMonth());
    document.getElementById('btn-prev-day').addEventListener('click', () => this.previousDay());
    document.getElementById('btn-next-day').addEventListener('click', () => this.nextDay());
    document.getElementById('btn-today').addEventListener('click', () => this.goToday());
    document.getElementById('btn-load-demo').addEventListener('click', () => this.loadDemoData());
    document.getElementById('select-start-year').addEventListener('change', (e) => this.changeStartYear(e));
    document.getElementById('btn-close-image').addEventListener('click', () => this.closeImageDialog());
    document.getElementById('btn-close-info').addEventListener('click', () => this.closeInfoDialog());
    document.getElementById('dialog-image').addEventListener('click', (e) => {
      if (e.target.id === 'dialog-image') this.closeImageDialog();
    });
    document.getElementById('dialog-info').addEventListener('click', (e) => {
      if (e.target.id === 'dialog-info') this.closeInfoDialog();
    });
  }

  getBaseYear(today) {
    const currentYear = today.getFullYear();
    if (currentYear >= this.startYear && currentYear <= this.startYear + 2) {
      return currentYear;
    }
    return this.startYear;
  }

  isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  renderCalendar() {
    const year = this.selectedYear, month = this.selectedMonth;
    document.getElementById('display-month').textContent = `${year}년 ${month + 1}월`;
    const yearSelect = document.getElementById('calendar-year');
    yearSelect.replaceChildren(...Array.from({length: 3}, (_, i) => {
      const value = this.startYear + i;
      return new Option(`${value}년 달력`, value);
    }));
    yearSelect.value = String(year);
    const tbody = document.getElementById('calendar-body');
    tbody.replaceChildren();
    const first = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    for (let index = 0; index < Math.ceil((first + count) / 7) * 7; index++) {
      if (index % 7 === 0) tbody.appendChild(document.createElement('tr'));
      const cell = document.createElement('td');
      const day = index - first + 1;
      if (day > 0 && day <= count) {
        const button = document.createElement('button');
        button.textContent = day;
        button.className = 'calendar-day';
        button.setAttribute('aria-label', `${year}년 ${month + 1}월 ${day}일`);
        if (day === this.selectedDate) {
          button.classList.add('selected');
          button.setAttribute('aria-current', 'date');
        }
        button.addEventListener('click', () => this.selectDate(day));
        cell.appendChild(button);
      }
      tbody.lastElementChild.appendChild(cell);
    }
  }

  selectDate(day) {
    if (this.requestInProgress) return;
    if (this.hasPendingChanges()) {
      if (!confirm('저장되지 않은 변경 사항이 있습니다. 계속 진행하시겠습니까?')) {
        this.renderCalendar();
        return;
      }
    }
    
    this.selectedDate = day;
    this.renderCalendar();
    this.updateDateDisplay();
    this.loadDiarySections();
  }

  previousMonth() {
    this.moveMonth(-1);
  }

  nextMonth() {
    this.moveMonth(1);
  }

  previousDay() {
    if (this.requestInProgress) return;
    if (this.hasPendingChanges()) {
      if (!confirm('저장되지 않은 변경 사항이 있습니다. 계속 진행하시겠습니까?')) {
        return;
      }
    }
    
    const validYear = [this.selectedYear, this.startYear, this.startYear + 1, this.startYear + 2]
      .find(year => new Date(year, this.selectedMonth, this.selectedDate).getMonth() === this.selectedMonth);
    const referenceYear = validYear === undefined ? 2000 : validYear;
    const date = new Date(referenceYear, this.selectedMonth, this.selectedDate - 1);
    this.selectedYear = (validYear === undefined ? this.selectedYear : validYear) + date.getFullYear() - referenceYear;
    this.selectedMonth = date.getMonth();
    this.selectedDate = date.getDate();
    this.renderCalendar();
    this.updateDateDisplay();
    this.loadDiarySections();
  }

  nextDay() {
    if (this.requestInProgress) return;
    if (this.hasPendingChanges()) {
      if (!confirm('저장되지 않은 변경 사항이 있습니다. 계속 진행하시겠습니까?')) {
        return;
      }
    }
    
    const validYear = [this.selectedYear, this.startYear, this.startYear + 1, this.startYear + 2]
      .find(year => new Date(year, this.selectedMonth, this.selectedDate).getMonth() === this.selectedMonth);
    const referenceYear = validYear === undefined ? 2000 : validYear;
    const date = new Date(referenceYear, this.selectedMonth, this.selectedDate + 1);
    this.selectedYear = (validYear === undefined ? this.selectedYear : validYear) + date.getFullYear() - referenceYear;
    this.selectedMonth = date.getMonth();
    this.selectedDate = date.getDate();
    this.renderCalendar();
    this.updateDateDisplay();
    this.loadDiarySections();
  }

  goToday() {
    if (this.requestInProgress) return;
    if (this.hasPendingChanges()) {
      if (!confirm('저장되지 않은 변경 사항이 있습니다. 계속 진행하시겠습니까?')) {
        return;
      }
    }
    
    const today = this.koreanToday();
    this.selectedYear = this.getBaseYear(today);
    this.selectedMonth = today.getMonth();
    this.selectedDate = today.getDate();
    this.renderCalendar();
    this.updateDateDisplay();
    this.loadDiarySections();
  }

  updateDateDisplay() {
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dateStr = `${monthNames[this.selectedMonth]} ${this.selectedDate}일`;
    document.getElementById('display-date').textContent = dateStr;
    document.querySelector('.content-area').dataset.season = this.getSeason(this.selectedMonth);
    document.getElementById('daily-question').textContent = this.dailyQuestion(this.selectedMonth, this.selectedDate);
    this.updateCheer();
  }

  // One gentle line under the question: an invitation to write today, praise once today is written, a saying otherwise.
  // The same date always gets the same line, so it does not change on every click.
  cheerLine(month, day, state) {
    const lines = CHEER_LINES[state] || CHEER_LINES.saying;
    const index = Math.round((Date.UTC(2024, month, day) - Date.UTC(2024, 0, 1)) / 86400000);
    return lines[index % lines.length];
  }

  cheerState() {
    const today = this.koreanToday();
    if (today.getMonth() !== this.selectedMonth || today.getDate() !== this.selectedDate) return 'saying';
    const entry = this.entries && this.entries[today.getFullYear()];
    const written = !!entry && entry.date === this.getDateString(today.getFullYear(), this.selectedMonth, this.selectedDate) && !!entry.content;
    return written ? 'praise' : 'invite';
  }

  updateCheer() {
    const box = document.getElementById('daily-cheer');
    if (box) box.textContent = this.cheerLine(this.selectedMonth, this.selectedDate, this.cheerState());
  }

  // The same month/day gets the same question every year, so three years of answers line up.
  dailyQuestion(month, day) {
    const index = Math.round((Date.UTC(2024, month, day) - Date.UTC(2024, 0, 1)) / 86400000);
    return DAILY_QUESTIONS[index % DAILY_QUESTIONS.length];
  }

  // Invites reading earlier years first when the latest writable year is still empty. No counts or scores.
  updatePastBanner() {
    const banner = document.getElementById('past-banner');
    if (!banner) return;
    const today = this.koreanToday();
    const years = [0, 1, 2].map(offset => this.startYear + offset).filter(year =>
      !(this.selectedMonth === 1 && this.selectedDate === 29 && !this.isLeapYear(year))
      && new Date(year, this.selectedMonth, this.selectedDate) <= today);
    const entryOf = year => {
      const entry = this.entries[year];
      return entry && entry.date === this.getDateString(year, this.selectedMonth, this.selectedDate) ? entry : null;
    };
    const latest = years[years.length - 1];
    const past = years.slice(0, -1).filter(year => entryOf(year) && entryOf(year).content);
    const latestEntry = latest === undefined ? null : entryOf(latest);
    if (!past.length || !latestEntry || latestEntry.content) {
      banner.hidden = true;
      return;
    }
    document.getElementById('past-banner-text').textContent = `${past.join('·')}년의 오늘이 기다리고 있어요. ${latest}년의 오늘은 아직 비어 있어요.`;
    this.pastBannerYear = past[0];
    banner.hidden = false;
  }

  readPastEntry() {
    const section = document.querySelector(`.diary-section[data-year="${this.pastBannerYear}"]`);
    if (!section) return;
    section.scrollIntoView({behavior: 'smooth', block: 'start'});
    section.querySelector('textarea').focus({preventScroll: true});
  }

  renderDiarySections() {
    const container = document.getElementById('diary-sections');
    container.innerHTML = '';
    this.entries = {};
    
    for (let offset = 0; offset < 3; offset++) {
      const year = this.startYear + offset;
      const section = this.createDiarySection(year);
      container.appendChild(section);
    }
  }

  createDiarySection(year) {
    const section = document.createElement('div');
    section.className = `diary-section season-${this.getSeason(this.selectedMonth)}`;
    section.dataset.year = year;
    
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <span class="year-title">${year}</span>
      <span class="weekday-text">-</span>
    `;
    section.appendChild(header);
    
    const wrapper = document.createElement('div');
    wrapper.className = 'section-textarea-wrapper';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'section-textarea';
    textarea.dataset.year = year;
    textarea.placeholder = '여기에 기록하세요';
    textarea.maxLength = 10000;
    textarea.setAttribute('aria-label', `${year}년 일기`);
    textarea.addEventListener('input', (e) => this.onTextareaInput(year, e));
    wrapper.appendChild(textarea);
    
    const status = document.createElement('div');
    status.className = 'section-status';
    status.id = `status-${year}`;
    status.setAttribute('aria-live', 'polite');
    wrapper.appendChild(status);
    
    const buttons = document.createElement('div');
    buttons.className = 'section-buttons';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save';
    saveBtn.textContent = '저장';
    saveBtn.dataset.year = year;
    saveBtn.addEventListener('click', () => this.saveDiary(year));
    buttons.appendChild(saveBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '삭제';
    deleteBtn.dataset.year = year;
    deleteBtn.addEventListener('click', () => this.deleteDiary(year));
    buttons.appendChild(deleteBtn);

    const shorts = document.createElement('button');
    shorts.className = 'btn-shorts';
    shorts.dataset.year = year;
    shorts.textContent = '쇼츠 만들기';
    shorts.disabled = true;
    shorts.addEventListener('click', () => this.showShortsDialog(year));
    buttons.appendChild(shorts);

    wrapper.appendChild(buttons);
    // Picture progress and errors (the picture itself is shown faintly behind the diary).
    const imgStatus = document.createElement('div');
    imgStatus.className = 'image-status';
    imgStatus.id = `image-status-${year}`;
    imgStatus.setAttribute('aria-live', 'polite');
    wrapper.appendChild(imgStatus);
    section.appendChild(wrapper);

    return section;
  }

  async loadDiarySections() {
    this.requestInProgress = true;
    this.dirtyFlags = {};
    try {
      await Promise.all(Array.from({length: 3}, (_, offset) => {
        const year = this.startYear + offset;
        return this.loadDiary(year, this.getDateString(year, this.selectedMonth, this.selectedDate));
      }));
      this.updatePastBanner();
    } finally {
      this.requestInProgress = false;
    }
  }

  async loadDiary(year, dateStr) {
    const section = document.querySelector(`.diary-section[data-year="${year}"]`);
    const textarea = section.querySelector('textarea');
    const status = document.getElementById(`status-${year}`);
    const buttons = section.querySelectorAll('.btn-save,.btn-delete,.btn-shorts');
    section.className = `diary-section season-${this.getSeason(this.selectedMonth)}`;
    textarea.disabled = true;
    buttons.forEach(button => button.disabled = true);
    delete this.draftConflicts[year];
    const valid = !(this.selectedMonth === 1 && this.selectedDate === 29 && !this.isLeapYear(year));
    section.querySelector('.weekday-text').textContent = valid
      ? ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'][new Date(year, this.selectedMonth, this.selectedDate).getDay()]
      : '—';
    if (!valid || new Date(year, this.selectedMonth, this.selectedDate) > this.koreanToday()) {
      textarea.value = '';
      textarea.placeholder = valid ? '아직 오지 않은 날' : '이 연도에는 2월 29일이 없어요';
      status.className = 'section-status';
      status.textContent = valid ? '아직 오지 않은 날' : '존재하지 않는 날짜';
      this.setDiaryPicture(year, null);
      document.getElementById(`image-status-${year}`).textContent = '';
      this.unsavedData[year] = '';
      return;
    }
    try {
      const response = await fetch(`/api/diary?date=${dateStr}`);
      if (!response.ok) throw new Error('기록을 읽지 못했습니다.');
      const entry = await response.json();
      if (typeof entry.content !== 'string') throw new Error('기록 형식이 올바르지 않습니다.');
      textarea.value = entry.content;
      textarea.style.height = entry.content.length > 200 ? '300px' : '';
      textarea.placeholder = entry.content ? '이날의 이야기를 적어보세요…' : `오늘의 질문 · ${this.dailyQuestion(this.selectedMonth, this.selectedDate)}`;
      textarea.disabled = false;
      buttons[0].disabled = false;
      buttons[1].disabled = !entry.content;
      this.unsavedData[year] = entry.content;
      this.dirtyFlags[year] = false;
      status.className = entry.is_demo ? 'section-status demo' : 'section-status';
      status.textContent = entry.is_demo ? '시연용 가상 기록' : '';
      document.querySelector(`.btn-delete[data-year="${year}"]`).disabled = !entry.content;
      this.updateImageDisplay(year, entry);
      this.restoreDraft(year, entry, textarea, status);
    } catch (error) {
      status.className = 'section-status error';
      status.textContent = '불러오기 실패. 날짜를 다시 선택해 재시도해 주세요.';
    }
  }

  onTextareaInput(year, event) {
    this.dirtyFlags[year] = event.target.value !== (this.unsavedData[year] || '');
    // Keep the conflicting draft untouched until the user chooses restore or discard.
    if (this.draftConflicts[year]) return;
    try {
      const key = 'diary-draft:' + this.getDateString(year, this.selectedMonth, this.selectedDate);
      if (this.dirtyFlags[year]) localStorage.setItem(key, JSON.stringify({content:event.target.value,base:this.unsavedData[year] || ''}));
      else localStorage.removeItem(key);
      if (typeof document !== 'undefined') document.getElementById(`status-${year}`).textContent = this.dirtyFlags[year] ? '이 브라우저에 임시 저장됨 · 일기 저장은 별도예요' : '';
    } catch (error) {
      if (typeof document !== 'undefined') document.getElementById(`status-${year}`).textContent = '임시 저장을 사용할 수 없어요. 저장 버튼으로 기록해 주세요.';
    }
  }

  restoreDraft(year, entry, textarea, status) {
    delete this.draftConflicts[year];
    try {
      const key = 'diary-draft:' + entry.date;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (typeof draft.content !== 'string' || draft.content.length > 10000) return;
      if (draft.content === entry.content) {localStorage.removeItem(key); return;}
      const restore = () => {
        delete this.draftConflicts[year];
        textarea.value = draft.content;
        textarea.style.height = draft.content.length > 200 ? '300px' : '';
        this.dirtyFlags[year] = draft.content !== entry.content;
        try {localStorage.setItem(key, JSON.stringify({content:draft.content,base:entry.content}));} catch (error) { /* The visible text is still restored. */ }
        status.textContent = '임시 저장한 글을 복구했어요. 저장 버튼으로 반영해 주세요.';
      };
      if (draft.base === entry.content) restore();
      else {
        this.draftConflicts[year] = true;
        status.textContent = '저장된 일기와 다른 임시 글이 있어요. 선택하기 전까지 임시 글은 그대로 보관돼요. ';
        const button = document.createElement('button'); button.textContent = '임시 글 복구';
        button.addEventListener('click', restore); status.appendChild(button);
        const discard = document.createElement('button'); discard.textContent = '임시 글 버리기';
        discard.addEventListener('click', () => {
          delete this.draftConflicts[year];
          try {localStorage.removeItem(key);} catch (error) { /* Nothing else to discard. */ }
          status.textContent = '';
          this.onTextareaInput(year, {target:textarea});
        }); status.appendChild(discard);
      }
    } catch (error) {status.textContent = '임시 저장을 확인하지 못했어요. 저장된 일기는 유지돼요.';}
  }

  async saveDiary(year) {
    if (this.requestInProgress) return;
    
    const textarea = document.querySelector(`textarea[data-year="${year}"]`);
    const content = textarea.value.trim();
    const status = document.getElementById(`status-${year}`);
    
    if (!content) {
      status.className = 'section-status error';
      status.textContent = '내용을 입력하세요';
      return;
    }
    
    const dateStr = this.getDateString(year, this.selectedMonth, this.selectedDate);
    this.requestInProgress = true;
    textarea.disabled = true;
    const generation = {};
    this.requestGenerations[year] = generation;
    
    status.className = 'section-status saving';
    status.textContent = '저장 중...';
    
    try {
      const response = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, content: content })
      });
      
      if (this.requestGenerations[year] !== generation) return;
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Save failed');
      }
      
      const entry = await response.json();
      this.unsavedData[year] = content;
      this.dirtyFlags[year] = false;
      // An unresolved conflicting draft stays until the user restores or discards it.
      if (!this.draftConflicts[year]) {
        try {localStorage.removeItem('diary-draft:' + dateStr);} catch (error) { /* Browser storage may be disabled. */ }
      }
      
      status.className = 'section-status success';
      status.textContent = '저장됨';
      setTimeout(() => {
        status.className = 'section-status';
        status.textContent = '';
      }, 2000);
      
      document.querySelector(`.btn-delete[data-year="${year}"]`).disabled = !entry.content;
      this.updateImageDisplay(year, entry);
      // A first picture follows the consent setting; replacing an existing one asks each time.
      const consent = document.getElementById('image-consent');
      if (entry.content && this.imageConfigured && consent && consent.checked
          && (!entry.image_path || (entry.image_stale && confirm('수정한 일기로 배경 수채화를 새로 만들까요? 약 15크레딧이 사용돼요. 취소해도 일기는 저장됐어요.')))) {
        await this.requestImage(year, entry, false);
      } else if (entry.content && !entry.image_path && this.imageConfigured) {
        document.getElementById(`image-status-${year}`).textContent = '설정에서 그림 생성에 동의하면 저장할 때 배경 수채화가 자동으로 만들어져요.';
      }
    } catch (error) {
      if (this.requestGenerations[year] !== generation) return;
      status.className = 'section-status error';
      status.textContent = error.message || '저장 실패';
    } finally {
      this.requestInProgress = false;
      textarea.disabled = false;
    }
  }

  updateImageDisplay(year, entry) {
    this.entries[year] = entry;
    if (document.getElementById('past-banner')) this.updatePastBanner();
    this.updateCheer();
    document.querySelector(`.btn-shorts[data-year="${year}"]`).disabled = !entry.content;
    const status = document.getElementById(`image-status-${year}`);
    status.className = 'image-status';
    this.setDiaryPicture(year, entry.image_path || null);
    if (entry.image_path && entry.image_stale) {
      status.classList.add('stale');
      status.textContent = entry.is_demo && entry.image_path.startsWith('/assets/') ? '배경은 참고용 시연 그림이에요.' : '배경 그림은 수정 전 일기로 만든 거예요.';
    } else {
      status.textContent = '';
    }
  }

  // The diary's watercolor shown faintly behind the writing; no picture leaves the diary as it was.
  setDiaryPicture(year, url) {
    const section = document.querySelector(`.diary-section[data-year="${year}"]`);
    const wrapper = section && section.querySelector('.section-textarea-wrapper');
    if (!wrapper) return;
    // '../assets/' is the online demo's (GitHub Pages) path to the same bundled pictures.
    const safe = typeof url === 'string' && /^(\/(media|assets)|\.\.\/assets)\/[\w.-]+$/.test(url);
    wrapper.classList.toggle('has-picture', safe);
    if (safe) wrapper.style.setProperty('--diary-picture', `url("${url}")`);
    else wrapper.style.removeProperty('--diary-picture');
  }

  async requestImage(year, entry, regenerate) {
    const status = document.getElementById(`image-status-${year}`);
    status.className = 'image-status';
    status.textContent = '배경 수채화를 만들고 있어요… 일기는 저장되어 있어요.';
    try {
      const response = await fetch('/api/image', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({date:entry.date, content_hash:entry.content_hash, regenerate, consent:true})
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('그림 응답을 확인하지 못했습니다. 재시도 전에 학교 사용량을 확인해 주세요.'); }
      if (!response.ok) throw new Error(data.error || '그림을 만들지 못했습니다.');
      if (!data.entry || !data.entry.image_path) throw new Error('완성된 그림을 확인하지 못했습니다.');
      this.updateImageDisplay(year, data.entry);
      if (data.cached) status.textContent = '저장된 수채화를 배경에 사용했어요. 추가 생성 없음.';
      else status.textContent = typeof data.credits_charged === 'number'
        ? `배경 수채화가 완성됐어요 · ${data.credits_charged}크레딧 사용`
        : '배경 수채화가 완성됐어요. 정확한 차감량은 학교 사용량에서 확인해 주세요.';
    } catch (error) {
      status.className = 'image-status error';
      status.textContent = `${error.message || '그림 연결에 실패했어요.'} 일기와 이전 그림은 유지됩니다. 다시 저장하면 다시 시도해요.`;
    }
  }

  async deleteDiary(year) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    if (this.requestInProgress) return;
    
    const dateStr = this.getDateString(year, this.selectedMonth, this.selectedDate);
    this.requestInProgress = true;
    
    try {
      const response = await fetch(`/api/diary?date=${dateStr}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      
      try {localStorage.removeItem('diary-draft:' + dateStr);} catch (error) { /* Keep deletion available without browser storage. */ }
      await this.loadDiary(year, dateStr);
      this.dirtyFlags[year] = false;
    } catch (error) {
      alert('삭제 실패: ' + error.message);
    } finally {
      this.requestInProgress = false;
    }
  }

  async changeStartYear(event) {
    if (this.requestInProgress || !this.confirmNavigation()) {
      this.updateStartYearSelect();
      return;
    }
    const year = Number(event.target.value);
    this.requestInProgress = true;
    try {
      const response = await fetch('/api/settings', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({start_year: year})
      });
      if (!response.ok) throw new Error('설정 저장 실패');
      this.startYear = year;
      this.selectedYear = this.getBaseYear(this.koreanToday());
      this.dirtyFlags = {};
      this.unsavedData = {};
      this.renderCalendar();
      this.renderDiarySections();
      await this.loadDiarySections();
    } catch (error) {
      this.showInfoDialog('설정 저장 실패', '기존 기간과 기록을 유지했습니다. 다시 시도해 주세요.');
      this.updateStartYearSelect();
    } finally {
      this.requestInProgress = false;
    }
  }

  async loadDemoData() {
    if (this.requestInProgress || !this.confirmNavigation()) return;
    this.requestInProgress = true;
    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) throw new Error('Demo load failed');
      
      const data = await response.json();
      this.startYear = data.start_year;
      this.selectedYear = this.getBaseYear(this.koreanToday());
      this.selectedMonth = data.month - 1;
      this.selectedDate = data.day;
      
      this.dirtyFlags = {};
      this.unsavedData = {};
      
      this.updateStartYearSelect();
      this.renderCalendar();
      this.updateDateDisplay();
      this.renderDiarySections();
      await this.loadDiarySections();
      
      this.showInfoDialog('시연 데이터 로드됨', '2024·2025·2026년 11월 17일의 가상 기록입니다. 기존 기록은 보존했습니다.');
    } catch (error) {
      alert('시연 데이터 로드 실패');
    } finally {
      this.requestInProgress = false;
    }
  }

  async showShortsDialog(year) {
    if (this.requestInProgress) return;
    if (this.dirtyFlags[year]) {
      this.showInfoDialog('먼저 일기를 저장해 주세요', '편집한 내용을 저장한 다음 쇼츠를 만들어 주세요.');
      return;
    }
    const entry = this.entries[year];
    if (!entry || !entry.content) return;
    if (!entry.image_path || entry.image_stale) {
      this.showInfoDialog('먼저 수채화를 준비해 주세요', '이 일기의 최신 내용으로 그림을 만든 다음 쇼츠를 만들 수 있어요.');
      return;
    }
    this.shortsEntry = entry;
    document.getElementById('shorts-date').textContent = entry.date + (entry.is_demo ? ' · 시연용 가상 기록' : '');
    document.getElementById('shorts-captions').value = '';
    const spokenBox = document.getElementById('shorts-spoken');
    if (spokenBox) spokenBox.value = '';
    document.getElementById('shorts-story').replaceChildren();
    const aiVideo = document.getElementById('shorts-ai-video');
    if (aiVideo) aiVideo.checked = false;
    this.updateClipCost();
    document.getElementById('make-shorts').disabled = true;
    document.getElementById('shorts-video').pause();
    document.getElementById('shorts-video').hidden = true;
    document.getElementById('download-shorts').hidden = true;
    document.getElementById('shorts-status').textContent = '';
    document.getElementById('dialog-shorts').showModal();
    await this.prepareShortsStory();
  }

  renderShortsStory() {
    this.renderStoryList();
    this.updateClipCost();
  }

  shortsCaptions() {
    return document.getElementById('shorts-captions').value.split('\n').map(line => line.trim()).filter(Boolean);
  }

  // Each scene sentence is its own field: tap to edit. The hidden textarea stays the single source of truth.
  renderStoryList() {
    const story = document.getElementById('shorts-story');
    story.replaceChildren();
    this.shortsCaptions().forEach((caption, index) => {
      const scene = document.createElement('li');
      const field = document.createElement('input');
      field.type = 'text'; field.value = caption; field.maxLength = 64;
      field.className = 'story-line'; field.setAttribute('aria-label', `장면 ${index + 1} 문장`);
      field.addEventListener('input', () => {
        const lines = this.shortsCaptions();
        lines[index] = field.value.replace(/\s+/g, ' ');
        document.getElementById('shorts-captions').value = lines.join('\n');
      });
      scene.appendChild(field);
      story.appendChild(scene);
    });
  }

  // One clip per scene, so the shorts never show the same clip twice.
  clipAnchors(count) {
    return Array.from({length: count}, (_, index) => index);
  }

  updateClipCost() {
    const label = document.getElementById('shorts-video-cost');
    if (!label) return;
    const count = this.shortsCaptions().length;
    const each = this.videoInfo && Number.isFinite(this.videoInfo.estimated_credits) ? this.videoInfo.estimated_credits : 60;
    label.textContent = count ? `(영상 ${this.clipAnchors(count).length}개 · 최대 약 ${this.clipAnchors(count).length * each}크레딧, 1~2분씩)` : '';
  }

  spokenLines() {
    const box = document.getElementById('shorts-spoken');
    return box ? box.value.split('\n').map(line => line.trim()).filter(Boolean) : [];
  }

  async prepareShortsStory() {
    if (this.requestInProgress || !this.shortsEntry) return;
    const entry = this.shortsEntry;
    this.requestInProgress = true;
    const retry = document.getElementById('retry-story'); retry.hidden = true;
    const button = document.getElementById('make-shorts'); button.disabled = true;
    document.getElementById('close-shorts').disabled = true;
    const dialog = document.getElementById('dialog-shorts');
    const preventClose = event => event.preventDefault(); dialog.addEventListener('cancel', preventClose);
    const status = document.getElementById('shorts-status');
    status.textContent = '일기를 읽고 그날의 이야기를 구성하고 있어요…';
    try {
      const response = await fetch('/api/shorts/story', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:entry.date,content_hash:entry.content_hash,consent:true})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '이야기를 구성하지 못했습니다.');
      if (!Array.isArray(data.captions) || !data.captions.length || data.captions.length > 8 || data.captions.some(line => typeof line !== 'string' || !line.trim() || line.length > 64)) throw new Error('이야기 형식을 확인하지 못했습니다.');
      document.getElementById('shorts-captions').value = data.captions.join('\n');
      const spokenBox = document.getElementById('shorts-spoken');
      if (spokenBox) spokenBox.value = Array.isArray(data.narration) && data.narration.length === data.captions.length ? data.narration.join('\n') : '';
      this.renderShortsStory();
      button.disabled = false;
      const usage = data.cached ? '저장된 이야기 재사용 · 추가 AI 호출 없음' : (data.credits_charged == null ? '차감량은 학교 사용량에서 확인해 주세요.' : `이야기 구성 ${data.credits_charged}크레딧`);
      const notes = [data.shortened ? 'AI 문장이 길어 장면마다 줄였어요. 필요하면 수정해 주세요.' : '', data.edited ? '이전에 수정한 이야기를 불러왔어요.' : '', data.demo ? '시연용으로 미리 작성해 둔 이야기예요(AI 호출 없음).' : ''].filter(Boolean).join(' ');
      status.textContent = `${data.captions.length}개 장면으로 구성했어요. ${usage}${notes ? ' ' + notes : ''}`;
    } catch (error) {
      status.textContent = error.message + ' 원본 일기는 그대로예요. 재시도 전 학교 사용량을 확인해 주세요.';
      retry.hidden = false;
    } finally {
      this.requestInProgress = false;
      document.getElementById('close-shorts').disabled = false;
      dialog.removeEventListener('cancel', preventClose);
    }
  }

  // Short AI video clips (Seedance) made from the scene sentences alone. Finished or running ones cost nothing.
  // Returns true when every clip is ready. The caller holds requestInProgress.
  async prepareClips(captions) {
    const entry = this.shortsEntry;
    const status = document.getElementById('shorts-status');
    const anchors = this.clipAnchors(captions.length);
    const post = (path, body) => fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const each = this.videoInfo && Number.isFinite(this.videoInfo.estimated_credits) ? this.videoInfo.estimated_credits : 60;
    let credits = 0, unknownCredits = false;
    status.textContent = '이미 만든 장면 영상을 확인하고 있어요…';
    let missing = 0;
    for (const index of anchors) {
      const check = await post('/api/shorts/clip', {date:entry.date,content_hash:entry.content_hash,caption:captions[index],check_only:true});
      const data = await check.json();
      if (!check.ok) throw Object.assign(new Error(data.error || '장면 영상 상태를 확인하지 못했어요.'), {free:true});
      if (!data.cached && !data.processing) missing++;
    }
    if (missing && !this.imageConfigured) throw Object.assign(new Error('학교 API 키를 설정한 뒤 AI 영상을 만들 수 있어요.'), {free:true});
    if (missing && !confirm(`장면 영상 ${missing}개(각 5초, Seedance)를 새로 만들어요. 약 ${missing * each}크레딧이 사용되고 장면 문장이 학교 API로 전송됩니다. 계속할까요?`)) {
      status.textContent = 'AI 영상 만들기를 취소했어요. 체크를 끄면 일기 그림으로 바로 만들 수 있어요.';
      return false;
    }
    for (let i = 0; i < anchors.length; i++) {
      // A clip takes about 30 seconds to 2 minutes; "still processing" answers are asked again (never paid twice).
      for (;;) {
        status.textContent = `장면 영상 ${i+1}/${anchors.length} 만드는 중… 1~2분쯤 걸려요. 창을 닫지 말아 주세요.`;
        const response = await post('/api/shorts/clip', {date:entry.date,content_hash:entry.content_hash,caption:captions[anchors[i]],consent:true});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '장면 영상을 만들지 못했어요.');
        if (typeof data.credits_charged === 'number') credits += data.credits_charged; else unknownCredits = true;
        if (data.status === 'completed') break;
      }
    }
    this.clipCredits = unknownCredits ? null : credits;
    return true;
  }

  async showSavedVideos(date) {
    if (this.requestInProgress) return;
    if (date === undefined) date = this.savedVideoDates();
    const dialog = document.getElementById('dialog-videos');
    document.getElementById('saved-videos').replaceChildren();
    document.getElementById('videos-status').textContent = '보관한 영상을 확인하고 있어요…';
    dialog.showModal();
    await this.loadSavedVideos(date);
  }

  // The selected month/day in each of the three years that has already come.
  savedVideoDates() {
    const today = this.koreanToday();
    return [0, 1, 2].map(offset => this.startYear + offset)
      .filter(year => !(this.selectedMonth === 1 && this.selectedDate === 29 && !this.isLeapYear(year))
        && new Date(year, this.selectedMonth, this.selectedDate) <= today)
      .map(year => this.getDateString(year, this.selectedMonth, this.selectedDate));
  }

  async loadSavedVideos(date) {
    const container = document.getElementById('saved-videos');
    try {
      const dates = Array.isArray(date) ? date : [date];
      const videos = [];
      for (const day of dates) {
        const response = await fetch('/api/videos?date='+day);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '영상을 불러오지 못했어요.');
        videos.push(...data.videos.map(saved => ({...saved, day})));
      }
      const data = {videos};
      container.replaceChildren();
      for (const saved of data.videos) {
        const section = document.createElement('section');
        const title = document.createElement('p');
        title.textContent = `${saved.day.slice(0,4)}년 · ${saved.kind === 'three-year' ? '3년 이야기' : '하루 이야기'} · ${saved.seconds}초 · ${saved.created_at.slice(0,16).replace('T',' ')}${saved.stale ? ' · 수정·삭제 전 일기로 만든 영상' : ''}`;
        const video = document.createElement('video'); video.controls = true; video.playsInline = true; this.showVideo(video, saved.url, saved.poster);
        const link = document.createElement('a'); link.href = saved.url; link.download = '일기_쇼츠.mp4'; link.textContent = 'MP4 저장';
        const credit = document.createElement('p'); credit.className = 'demo-label';
        credit.textContent = (Array.isArray(saved.music) && saved.music.length ? '음악: ' + saved.music.join(' / ') : '음악: AcousticGuitarSample — RyGuy, Public Domain')
          + (typeof saved.voice === 'string' && saved.voice ? ' · ' + saved.voice : '');
        section.append(title,video,link,credit); container.appendChild(section);
      }
      document.getElementById('videos-status').textContent = data.videos.length ? '일기를 바꿔도 완성된 영상은 보관돼요.' : '아직 이 날짜에 만든 쇼츠가 없어요.';
    } catch (error) {document.getElementById('videos-status').textContent = error.message;}
  }

  async makeThreeYearVideo() {
    if (this.requestInProgress) return;
    const entries = Array.from({length:3},(_,i)=>this.entries[this.startYear+i]);
    if (entries.some((e,i)=>this.dirtyFlags[this.startYear+i] || !e || !e.content || !e.image_path || e.image_stale || e.date !== this.getDateString(this.startYear+i,this.selectedMonth,this.selectedDate))) {
      this.showInfoDialog('세 해의 기록을 준비해 주세요','같은 날짜의 세 해 일기를 모두 저장하고 최신 수채화를 만든 다음 연결할 수 있어요.'); return;
    }
    const dialog = document.getElementById('dialog-videos');
    document.getElementById('saved-videos').replaceChildren();
    document.getElementById('videos-status').textContent = '세 해의 시작과 마무리를 연결하고 있어요…';
    dialog.showModal();
    const preventClose=e=>e.preventDefault(); dialog.addEventListener('cancel',preventClose);
    this.requestInProgress = true; document.getElementById('close-videos').disabled = true;
    try {
      const response = await fetch('/api/three-year-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:entries.map(e=>({date:e.date,content_hash:e.content_hash})),consent:true,music:this.selectedMusic('three-year-music'),narration:this.wantsNarration('three-year-narration')})});
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error || '3년 영상을 만들지 못했어요.'), {free: (response.status === 400 || response.status === 409) && data.may_charge !== true});
      await this.loadSavedVideos(entries[0].date);
    } catch (error) {
      // The server marks failures that happened during a story call (may_charge); other 400/409 are free checks.
      document.getElementById('videos-status').textContent = error.message + ' 원본은 유지돼요.' + (error.free ? '' : ' 재시도 전에 학교 사용량을 확인해 주세요.');
    }
    finally {this.requestInProgress = false; document.getElementById('close-videos').disabled = false; dialog.removeEventListener('cancel',preventClose);}
  }

  // A shorts video opens on a dark fade, so its still cover is a scene: the poster the server gives,
  // or else a frame a few seconds in, rewound to the start when play begins.
  showVideo(video, url, poster) {
    if (video.coverCleanup) video.coverCleanup();
    video.removeAttribute('poster');
    const safePoster = typeof poster === 'string' && /^(\/|\.\.\/)[\w./-]+\.(png|jpe?g)$/.test(poster) ? poster : '';
    if (safePoster) video.poster = safePoster;
    video.preload = safePoster ? 'metadata' : 'auto';
    video.src = url;
    if (safePoster || typeof video.addEventListener !== 'function') return;
    let cover = null;
    const onMeta = () => { if (video.currentTime === 0 && video.paused) { cover = Math.min(3, (video.duration || 0) / 3); video.currentTime = cover; } };
    const onPlay = () => { if (cover !== null && Math.abs(video.currentTime - cover) < 0.05) video.currentTime = 0; video.coverCleanup(); };
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.coverCleanup = () => { video.removeEventListener('loadedmetadata', onMeta); video.removeEventListener('play', onPlay); video.coverCleanup = null; };
  }

  async makeShorts() {
    if (this.requestInProgress || !this.shortsEntry) return;
    const captions = this.shortsCaptions();
    const status = document.getElementById('shorts-status');
    if (!captions.length || captions.length > 8 || captions.some(line => line.length > 64)) {
      status.textContent = '이야기를 먼저 구성해 주세요. 문장은 장면당 64자 이내로 확인해 주세요.';
      return;
    }
    // Spoken lines are optional; when given they must pair one-to-one with the scenes.
    const spoken = this.spokenLines();
    if (spoken.length && spoken.length !== captions.length) {
      status.textContent = `읽어 줄 문장을 장면 수와 같은 ${captions.length}줄로 맞춰 주세요. 비워 두면 자막을 그대로 읽어요.`;
      return;
    }
    const entry = this.shortsEntry;
    this.requestInProgress = true;
    const button = document.getElementById('make-shorts'); button.disabled = true;
    document.getElementById('close-shorts').disabled = true;
    const fields = [...document.querySelectorAll('#shorts-story input'), document.getElementById('shorts-ai-video')].filter(Boolean);
    fields.forEach(field => { field.disabled = true; });
    const dialog = document.getElementById('dialog-shorts');
    const preventClose = event => event.preventDefault(); dialog.addEventListener('cancel', preventClose);
    const aiVideo = document.getElementById('shorts-ai-video');
    const clips = Boolean(aiVideo && aiVideo.checked);
    this.clipCredits = 0;
    try {
      if (clips && !(await this.prepareClips(captions))) return;
      status.textContent = this.wantsNarration('shorts-narration') ? '자막을 목소리로 읽고 음악과 합쳐 쇼츠를 만들고 있어요…' : '음악, 자막과 합쳐 쇼츠를 만들고 있어요…';
      const response = await fetch('/api/shorts', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[{date:entry.date,content_hash:entry.content_hash,caption:captions[0]}],captions,clips,music:this.selectedMusic('shorts-music'),narration:this.wantsNarration('shorts-narration'),...(spoken.length ? {spoken} : {})})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '쇼츠 생성 실패');
      const video = document.getElementById('shorts-video'); this.showVideo(video, data.url, data.poster); video.hidden = false;
      const link = document.getElementById('download-shorts'); link.href = data.url; link.hidden = false;
      const used = clips ? (this.clipCredits == null ? ' AI 영상 차감량은 학교 사용량에서 확인해 주세요.' : ` AI 영상 ${this.clipCredits}크레딧`) : '';
      status.textContent = `${data.seconds}초 쇼츠가 완성됐어요. 재생하거나 MP4로 저장할 수 있어요.${used}`;
    } catch (error) {status.textContent = error.message + (error.free ? '' : ' 원본 일기는 그대로예요. 완성된 영상 장면은 보관돼요.');}
    finally {
      this.requestInProgress = false;
      button.disabled = false;
      document.getElementById('close-shorts').disabled = false;
      fields.forEach(field => { field.disabled = false; });
      dialog.removeEventListener('cancel', preventClose);
    }
  }

  showImageDialog(src) {
    const dialog = document.getElementById('dialog-image');
    const preview = document.getElementById('dialog-image-preview');
    preview.src = src;
    dialog.showModal();
  }

  closeImageDialog() {
    const dialog = document.getElementById('dialog-image');
    dialog.close();
  }

  showInfoDialog(title, message) {
    const dialog = document.getElementById('dialog-info');
    document.getElementById('dialog-title').textContent = title;
    document.getElementById('dialog-message').textContent = message;
    dialog.showModal();
  }

  closeInfoDialog() {
    const dialog = document.getElementById('dialog-info');
    dialog.close();
  }

  getDateString(year, month, date) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dateStr = String(date).padStart(2, '0');
    return `${year}-${monthStr}-${dateStr}`;
  }

  koreanToday() {
    const [year, month, day] = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date()).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  confirmNavigation() {
    return !this.hasPendingChanges() || confirm('저장하지 않은 내용이 있어요. 내용을 버리고 이동할까요?');
  }

  moveMonth(delta) {
    if (this.requestInProgress || !this.confirmNavigation()) return;
    const next = new Date(this.selectedYear, this.selectedMonth + delta, 1);
    this.selectedYear = next.getFullYear();
    this.selectedMonth = next.getMonth();
    this.selectedDate = Math.min(this.selectedDate, new Date(this.selectedYear, this.selectedMonth + 1, 0).getDate());
    this.renderCalendar();
    this.updateDateDisplay();
    this.loadDiarySections();
  }

  hasPendingChanges() {
    for (const year in this.dirtyFlags) {
      if (this.dirtyFlags[year]) return true;
    }
    return false;
  }
}

const app = new DiaryApp();
