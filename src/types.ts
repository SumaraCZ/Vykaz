export interface DayRecord {
  date: string; // Format: YYYY-MM-DD
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayNameShort: string; // Po, Út, St, etc.
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  
  // User inputs
  active: boolean; // Is marked as a working day (some days they don't work status)
  arrival: string; // "HH:MM"
  departure: string; // "HH:MM"
  interruptionFrom: string; // "HH:MM"
  interruptionTo: string; // "HH:MM"
  lunchTaken: boolean; // default: true (unpaid, so deducted) -> if false: no deduction (counted in work hours)
  note: string;
}

export interface MonthSummary {
  year: number;
  month: number; // 1-12
  records: Record<string, DayRecord>; // keyed by date (YYYY-MM-DD)
}

export interface AppSettings {
  defaultArrival: string; // "08:00"
  defaultDeparture: string; // "16:00"
  defaultLunchTaken: boolean; // true
  dailyWorkFund: number; // 7.5
  employeeName?: string; // e.g. "Lukáš Černý"
}
