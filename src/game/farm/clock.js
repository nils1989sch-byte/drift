// Game clock: day runs 06:00 → 02:00 (20 game hours). 1 game minute = 0.7 s real (a day ≈ 14 min).
//   const clock = createClock({ minuteSec: 0.7 });
//   clock.update(dt)   (does nothing while clock.paused)
//   clock.hours  float 0–24 (06:00 = 6, 01:30 = 1.5)   clock.day (1-based, total)   clock.season   clock.weekday
//   clock.onHour(fn(hour)), clock.onNewDay(fn(info)), clock.onPassOut(fn())  → unsubscribe functions
//   clock.sleep() → advances to 06:00 of the next day (fires onNewDay)   clock.setTime(hours)
export const DAY_START = 6;           // 06:00
export const DAY_END = 26;            // 02:00 next calendar day (internal, hours since midnight of the day)
export const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const SEASONS = ['fruehling', 'sommer', 'herbst', 'winter'];
export const SEASON_NAMES = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' };
export const SEASON_DAYS = 28;

export function createClock(opts = {}) {
  const minuteSec = opts.minuteSec ?? 0.7;
  const seasonsOn = !!opts.seasons;          // "vorerst Frühling": seasons stay 'fruehling' unless enabled
  let t = (opts.startHour ?? DAY_START) - DAY_START;   // game hours since 06:00 (0..20)
  let day = opts.day ?? 1;
  let lastHour = Math.floor(DAY_START + t);
  let passedOut = false;
  const L = { hour: new Set(), day: new Set(), passout: new Set(), minute: new Set() };
  const emit = (set, ...a) => { for (const f of set) { try { f(...a); } catch (e) { console.warn('[farm] clock listener', e); } } };
  const on = (set) => (fn) => { set.add(fn); return () => set.delete(fn); };

  const clock = {
    paused: false,
    minuteSec,
    get hours() { return (DAY_START + t) % 24; },
    set hours(h) { clock.setTime(h); },
    /** Hours since midnight of the current game day, 6 … 26 (continuous, handy for comparisons). */
    get abs() { return DAY_START + t; },
    get minutes() { return Math.floor(((DAY_START + t) % 1) * 60); },
    get day() { return day; },
    set day(d) { day = Math.max(1, d | 0); },
    get weekdayIndex() { return (day - 1) % 7; },
    get weekday() { return WEEKDAYS[(day - 1) % 7]; },
    get weekdayShort() { return WEEKDAYS_SHORT[(day - 1) % 7]; },
    get season() { return seasonsOn ? SEASONS[Math.floor((day - 1) / SEASON_DAYS) % 4] : 'fruehling'; },
    get seasonName() { return SEASON_NAMES[clock.season]; },
    get dayOfSeason() { return ((day - 1) % SEASON_DAYS) + 1; },
    get year() { return Math.floor((day - 1) / (SEASON_DAYS * 4)) + 1; },
    /** 0 = full daylight … 1 = deepest night (for the renderer / UI tint). */
    get darkness() {
      const h = DAY_START + t;
      if (h < 17) return h < 6.5 ? (6.5 - h) * 0.6 : 0;
      if (h < 20) return ((h - 17) / 3) * 0.55;
      return Math.min(1, 0.55 + ((h - 20) / 4) * 0.45);
    },
    get isNight() { return DAY_START + t >= 20; },
    /** "06:00", 10-minute steps like Stardew (display). */
    get timeText() { const h = DAY_START + t; const hh = Math.floor(h) % 24, mm = Math.floor(((h % 1) * 60) / 10) * 10; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; },
    get dateText() { return `${WEEKDAYS_SHORT[(day - 1) % 7]}. ${clock.dayOfSeason}. ${SEASON_NAMES[clock.season]}`; },

    update(dt) {
      if (clock.paused || passedOut || !(dt > 0)) return;
      t += dt / (minuteSec * 60);
      const absH = DAY_START + t;
      while (Math.floor(absH) > lastHour) { lastHour++; emit(L.hour, lastHour % 24, clock); }
      if (absH >= DAY_END) { t = DAY_END - DAY_START; passedOut = true; emit(L.passout, clock); }
    },
    /** Jump to a time of the current day (6 … 26; 0–2 are read as after midnight). */
    setTime(h) {
      if (h < DAY_START) h += 24;
      t = Math.max(0, Math.min(DAY_END - DAY_START, h - DAY_START));
      lastHour = Math.floor(DAY_START + t);
    },
    /** Ends the day: next morning 06:00. info = { day, prevDay, passedOut, weekday, season }. */
    sleep(reason = 'bed') {
      const prevDay = day;
      day++;
      t = 0; lastHour = DAY_START;
      const info = { day, prevDay, reason, passedOut: reason === 'passout', weekday: clock.weekday, season: clock.season, seasonChanged: clock.season !== (seasonsOn ? SEASONS[Math.floor((prevDay - 1) / SEASON_DAYS) % 4] : 'fruehling') };
      passedOut = false;
      emit(L.day, info, clock);
      return info;
    },
    get passedOut() { return passedOut; },
    onHour: on(L.hour),
    onNewDay: on(L.day),
    onPassOut: on(L.passout),
    serialize() { return { day, t: +t.toFixed(4) }; },
    deserialize(d) { if (!d) return false; day = Math.max(1, d.day | 0 || 1); t = Math.max(0, Math.min(DAY_END - DAY_START - 0.01, +d.t || 0)); lastHour = Math.floor(DAY_START + t); passedOut = false; return true; },
  };
  return clock;
}
