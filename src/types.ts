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
  /** Null when the entry is saved but the fresh sums could not be read; the client keeps its old sums. */
  summary: MonthSummary | null;
  /** True when the saved entry's date falls in the current month (Europe/Warsaw), i.e. the sums above include it. */
  inCurrentMonth: boolean;
}

/** A category as shown on the management page; archived ones stay in the list but are hidden from the entry grid. */
export interface ManagedCategory {
  id: string;
  name: string;
  archived: boolean;
}

export interface CategoryListResponse {
  /** Null when the change is saved but the fresh list could not be read; the client reloads the page. */
  categories: ManagedCategory[] | null;
}

/** A recurring expense as listed on the management page and in the month-screen reminder. */
export interface RecurringExpense {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryArchived: boolean;
  /** Integer minor units (grosze). */
  amountMinor: number;
  dayOfMonth: number;
  /** First day of the first / last month that has an entry, as YYYY-MM-DD. */
  startMonth: string;
  endMonth: string;
  /** Calendar months from the current month to endMonth; negative once the definition has lapsed. */
  monthsLeft: number;
  /** True while the end of the horizon is near and nobody dismissed the reminder. */
  remind: boolean;
}

export interface RecurringListResponse {
  /** Null when the change is saved but the fresh list could not be read; the client reloads the page. */
  items: RecurringExpense[] | null;
}

export interface ApiError {
  error: string;
}
