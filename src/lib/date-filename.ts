export interface FileNamePeriod {
  start: string;
  end: string;
}

function isValidDateParts(year: number, month: number, day: number) {
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isoDate(year: number, month: number, day: number) {
  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function orderedPeriod(start: string | null, end: string | null): FileNamePeriod | null {
  if (!start || !end) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

const RANGE_SEPARATOR = String.raw`(?:~|～|〜|\s+to\s+|\s*부터\s*|\s*에서\s*|-|_)`;

function fileNameOnly(name: string) {
  return name.split(/[\\/]/).pop() ?? name;
}

/**
 * Extracts an upload date range from file names.
 * Supports full date ranges like 20260601~20260603 and current-year ranges like 0601~0603.
 */
export function periodFromFileName(
  name: string,
  fallbackYear = new Date().getFullYear(),
): FileNamePeriod | null {
  const fileName = fileNameOnly(name);

  const fullRange = fileName.match(
    new RegExp(
      `(20\\d{2})[-_.\\s]?(\\d{2})[-_.\\s]?(\\d{2})\\s*${RANGE_SEPARATOR}\\s*(?:(20\\d{2})[-_.\\s]?)?(\\d{2})[-_.\\s]?(\\d{2})`,
    ),
  );
  if (fullRange) {
    const start = isoDate(
      Number(fullRange[1]),
      Number(fullRange[2]),
      Number(fullRange[3]),
    );
    const end = isoDate(
      Number(fullRange[4] ?? fullRange[1]),
      Number(fullRange[5]),
      Number(fullRange[6]),
    );
    const period = orderedPeriod(start, end);
    if (period) return period;
  }

  const compactMonthDayRange = fileName.match(
    new RegExp(`(?:^|[^\\d])(\\d{2})(\\d{2})\\s*${RANGE_SEPARATOR}\\s*(\\d{2})(\\d{2})(?:[^\\d]|$)`),
  );
  if (compactMonthDayRange) {
    const start = isoDate(
      fallbackYear,
      Number(compactMonthDayRange[1]),
      Number(compactMonthDayRange[2]),
    );
    const end = isoDate(
      fallbackYear,
      Number(compactMonthDayRange[3]),
      Number(compactMonthDayRange[4]),
    );
    const period = orderedPeriod(start, end);
    if (period) return period;
  }

  const spacedMonthDayRange = fileName.match(
    /(?:^|[^\d])(\d{1,2})[\s._-]+(\d{1,2})\s*(?:~|～|〜|\s+to\s+|\s*부터\s*|\s*에서\s*)\s*(\d{1,2})[\s._-]+(\d{1,2})(?:[^\d]|$)/,
  );
  if (spacedMonthDayRange) {
    const start = isoDate(
      fallbackYear,
      Number(spacedMonthDayRange[1]),
      Number(spacedMonthDayRange[2]),
    );
    const end = isoDate(
      fallbackYear,
      Number(spacedMonthDayRange[3]),
      Number(spacedMonthDayRange[4]),
    );
    const period = orderedPeriod(start, end);
    if (period) return period;
  }

  const single = dateFromFileName(name, fallbackYear);
  return single ? { start: single, end: single } : null;
}

/**
 * Extracts an upload date from file names.
 * Supports full dates like 20260601 and yearless current-year dates like 0601 or 6 1.
 */
export function dateFromFileName(name: string, fallbackYear = new Date().getFullYear()) {
  const fileName = fileNameOnly(name);

  const fullDate = fileName.match(/(20\d{2})[-_.\s]?(\d{2})[-_.\s]?(\d{2})/);
  if (fullDate) {
    return isoDate(Number(fullDate[1]), Number(fullDate[2]), Number(fullDate[3]));
  }

  const spacedMonthDay = fileName.match(/(?:^|[^\d])(\d{1,2})[\s._-]+(\d{1,2})(?:[^\d]|$)/);
  if (spacedMonthDay) {
    return isoDate(fallbackYear, Number(spacedMonthDay[1]), Number(spacedMonthDay[2]));
  }

  const compactMonthDay = fileName.match(/(?:^|[^\d])(\d{2})(\d{2})(?:[^\d]|$)/);
  if (compactMonthDay) {
    return isoDate(fallbackYear, Number(compactMonthDay[1]), Number(compactMonthDay[2]));
  }

  return null;
}
