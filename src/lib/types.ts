export type Role = 'mentor' | 'alumno';

export interface Week {
  weekNumber: number;
  label: string;
  days: WeekDay[];
}

export interface WeekDay {
  date: string;       // "2026-11-11"
  label: string;      // "Mié 11 Nov"
  shortLabel: string; // "Mié"
  dayOfMonth: number;
  monthLabel: string;
}
