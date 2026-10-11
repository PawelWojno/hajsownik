// Limits of a recurring definition, shared by the browser form and the zod schemas of the API (this module has no
// dependencies, so importing it does not pull zod into the client bundle). The database enforces the same bounds:
// CHECK day_of_month between 1 and 31, p_months between 1 and 24, a horizon of at most 24 months.

export const MIN_DAY_OF_MONTH = 1;
export const MAX_DAY_OF_MONTH = 31;

export const MIN_MONTHS = 1;
/** The horizon covers at most this many months counting the current one; also the most months one create adds. */
export const MAX_HORIZON_MONTHS = 24;

export const DAY_OF_MONTH_ERROR = `Dzień miesiąca musi być od ${MIN_DAY_OF_MONTH} do ${MAX_DAY_OF_MONTH}`;
export const MONTHS_ERROR = `Liczba miesięcy musi być od ${MIN_MONTHS} do ${MAX_HORIZON_MONTHS}`;
