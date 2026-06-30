export function getEasterDates(year: number): { goodFriday: string; easterMonday: string } {
  // Meeus/Jones/Butcher algorithm (accurate Easter date calculator)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  // Easter Sunday
  const easterSunday = new Date(year, month - 1, day);
  
  // Good Friday is 2 days before Easter Sunday
  const goodFridayDate = new Date(easterSunday);
  goodFridayDate.setDate(easterSunday.getDate() - 2);
  
  // Easter Monday is 1 day after Easter Sunday
  const easterMondayDate = new Date(easterSunday);
  easterMondayDate.setDate(easterSunday.getDate() + 1);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const mStr = String(date.getMonth() + 1).padStart(2, '0');
    const dStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${mStr}-${dStr}`;
  };

  return {
    goodFriday: formatDate(goodFridayDate),
    easterMonday: formatDate(easterMondayDate)
  };
}

export function getCzechHolidaysForYear(year: number): Record<string, string> {
  const { goodFriday, easterMonday } = getEasterDates(year);
  
  // Standard Czech holidays (státní svátky)
  const staticHolidays: Record<string, string> = {
    [`${year}-01-01`]: "Nový rok / Den obnovy samostatného českého státu",
    [`${year}-04-12`]: "", // Easter dates are variable, we override below
    [`${year}-05-01`]: "Svátek práce",
    [`${year}-05-08`]: "Den vítězství",
    [`${year}-07-05`]: "Den slovanských věrozvěstů Cyrila a Metoděje",
    [`${year}-07-06`]: "Den upálení mistra Jana Husa",
    [`${year}-09-28`]: "Den české státnosti",
    [`${year}-10-28`]: "Den vzniku samostatného československého státu",
    [`${year}-11-17`]: "Den boje za svobodu a demokracii",
    [`${year}-12-24`]: "Štědrý den",
    [`${year}-12-25`]: "1. svátek vánoční",
    [`${year}-12-26`]: "2. svátek vánoční",
  };

  // Clean the empty helper
  delete staticHolidays[`${year}-04-12`];

  return {
    ...staticHolidays,
    [goodFriday]: "Velký pátek (státní svátek)",
    [easterMonday]: "Velikonoční pondělí (státní svátek)"
  };
}

// Format date to local Czech names
export const CZECH_MONTHS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen", 
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"
];

export const CZECH_DAYS_SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTimeStr(totalMins: number): string {
  if (totalMins <= 0) return "0:00";
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function calculateDailyHours(
  arrival: string,
  departure: string,
  interruptionFrom: string,
  interruptionTo: string,
  lunchTaken: boolean,
  lunchDurationMins: number = 30,
  secondBreakNotTaken: boolean = false
): { exactMinutes: number; roundedHours: number; exactTimeStr: string } {
  if (!arrival || !departure) {
    return { exactMinutes: 0, roundedHours: 0, exactTimeStr: "0:00" };
  }

  const arr = parseTimeToMinutes(arrival);
  const dep = parseTimeToMinutes(departure);
  
  if (dep <= arr) {
    return { exactMinutes: 0, roundedHours: 0, exactTimeStr: "0:00" };
  }

  const grossMins = dep - arr;

  // Interruption logic
  let intMins = 0;
  if (interruptionFrom && interruptionTo) {
    const intFrom = parseTimeToMinutes(interruptionFrom);
    const intTo = parseTimeToMinutes(interruptionTo);
    if (intTo > intFrom) {
      intMins = intTo - intFrom;
    }
  }

  // Lunch break deduction. 
  // If lunchTaken === true (ano), we deduct lunch break from hours.
  // If lunchTaken === false (ne), we do NOT deduct lunch break (lunch time counts as worked hours).
  const lunchDeduction = lunchTaken ? lunchDurationMins : 0;

  let baseNetMins = grossMins - intMins - lunchDeduction;
  if (baseNetMins < 0) baseNetMins = 0;

  let netMins = baseNetMins;

  // Second break rule: if net work time exceeds 9 hours (540 minutes), they are entitled to another 15m break.
  // If they didn't take it due to continuous service, those 15m are added back.
  // If they did take it, it is deducted by law.
  if (baseNetMins > 540) {
    if (secondBreakNotTaken) {
      netMins = baseNetMins;
    } else {
      netMins = baseNetMins - 15;
    }
  }

  if (netMins < 0) netMins = 0;

  // Rounding: convert remaining minutes to closest 15 min interval
  // 15 min -> 0.25
  // 30 min -> 0.50
  // 45 min -> 0.75
  // 0 min -> 0.00
  const rawHours = Math.floor(netMins / 60);
  const remainingMinutes = netMins % 60;
  const roundedMins = Math.round(remainingMinutes / 15) * 15;
  
  let finalRoundedMins = roundedMins;
  let extraHr = 0;
  if (finalRoundedMins === 60) {
    finalRoundedMins = 0;
    extraHr = 1;
  }
  
  const roundedHours = rawHours + extraHr + (finalRoundedMins / 60);

  return {
    exactMinutes: netMins,
    roundedHours: Number(roundedHours.toFixed(2)),
    exactTimeStr: minutesToTimeStr(netMins)
  };
}
