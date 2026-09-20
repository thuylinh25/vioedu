export const pad = (n: number) => String(n).padStart(2, "0");

/** "19:30" -> { h: 7, m: 30, ap: "PM" } */
export const to12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { h: h % 12 || 12, m, ap: h < 12 ? "AM" : "PM" };
};

/** (7, 30, "PM") -> "19:30" — the 24h form Postgres `time` expects. */
export const to24 = (h: number, m: number, ap: string) =>
  `${pad(ap === "AM" ? h % 12 : (h % 12) + 12)}:${pad(m)}`;

/** "19:30" -> "07:30 PM" — the only format the UI shows. */
export const fmt12 = (t: string) => {
  const v = to12(t);
  return `${pad(v.h)}:${pad(v.m)} ${v.ap}`;
};

export const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Start time + duration, as a 24h "HH:MM" string. */
export const endOf = (t: string, duration: number) => {
  const v = minutesOf(t) + duration;
  return `${pad(Math.floor(v / 60) % 24)}:${pad(v % 60)}`;
};

export const DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateLabel = (d: Date) => `${DAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMonths = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Clamp: 31/01 + 1 month must land on 28/02, not 03/03.
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(d.getDate(), last));
  return x;
};

/** Weeks run Monday→Sunday, matching the T2…CN header. */
export const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const startOfWeek = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
};

export const weekDays = (d: Date) => {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Whole weeks covering the month — trailing empty week is never emitted. */
export const monthWeeks = (d: Date) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const rows = Math.ceil((offset + daysInMonth) / 7);
  const start = startOfWeek(first);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDays(start, r * 7 + c)),
  );
};

export const monthLabel = (d: Date) => `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
export const weekLabel = (d: Date) => {
  const days = weekDays(d);
  const a = days[0], b = days[6];
  return `${pad(a.getDate())}/${pad(a.getMonth() + 1)} - ${pad(b.getDate())}/${pad(b.getMonth() + 1)}`;
};
