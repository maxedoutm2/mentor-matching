import type { Week, WeekDay } from './types';

// Event starts Wednesday, November 11, 2026
const START_DATE = new Date('2026-11-11T00:00:00');

const DAY_SHORT: Record<number, string> = {
  0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb',
};

const MONTH_SHORT: Record<number, string> = {
  0: 'Ene', 1: 'Feb', 2: 'Mar', 3: 'Abr', 4: 'May', 5: 'Jun',
  6: 'Jul', 7: 'Ago', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dic',
};

function dateToString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildWeekDay(d: Date): WeekDay {
  const dow = d.getDay();
  const dom = d.getDate();
  const mon = MONTH_SHORT[d.getMonth()];
  return {
    date: dateToString(d),
    label: `${DAY_SHORT[dow]} ${dom} ${mon}`,
    shortLabel: DAY_SHORT[dow],
    dayOfMonth: dom,
    monthLabel: mon,
  };
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function getWeeks(): Week[] {
  return Array.from({ length: 7 }, (_, i): Week => {
    let days: WeekDay[];
    let label: string;

    if (i === 0) {
      // Week 1: starts on Wednesday Nov 11, only Wed-Fri (3 days)
      days = [0, 1, 2].map(offset => buildWeekDay(addDays(START_DATE, offset)));
      label = 'Semana 1 · 11-13 Nov';
    } else {
      // Weeks 2-7: Mon-Fri
      // Week 2 Monday = Nov 11 + 5 = Nov 16
      // Week N Monday = Nov 11 + (N-1)*7 - 2
      const mondayOffset = i * 7 - 2;
      days = [0, 1, 2, 3, 4].map(offset =>
        buildWeekDay(addDays(START_DATE, mondayOffset + offset))
      );
      const first = days[0];
      const last = days[days.length - 1];
      const sameMonth = first.monthLabel === last.monthLabel;
      label = `Semana ${i + 1} · ${first.dayOfMonth}${sameMonth ? '' : ` ${first.monthLabel}`}-${last.dayOfMonth} ${last.monthLabel}`;
    }

    return { weekNumber: i + 1, label, days };
  });
}

// Hours available for selection (8:00 to 21:00)
export const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // [8, 9, ..., 21]

export function formatHour(h: number): string {
  return `${h}:00`;
}

export function slotKey(date: string, hour: number): string {
  return `${date}_${hour}`;
}
