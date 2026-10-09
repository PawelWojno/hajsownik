export const INCOME_SOURCES = ["wynagrodzenie", "działalność", "świadczenia", "wynajem", "inne"] as const;

export type IncomeSource = (typeof INCOME_SOURCES)[number];

export interface Category {
  id: string;
  name: string;
}

/** All amounts are integer minor units (grosze). */
export interface MonthSummary {
  incomeTotal: number;
  expenseTotal: number;
  /** "zostaje": incomeTotal - expenseTotal. */
  left: number;
}

export interface SavedEntryResponse {
  summary: MonthSummary;
  /** True when the saved entry's date falls in the current month (Europe/Warsaw), i.e. the sums above include it. */
  inCurrentMonth: boolean;
}

export interface ApiError {
  error: string;
}
