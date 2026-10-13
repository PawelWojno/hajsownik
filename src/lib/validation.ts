import { z } from "zod";
import { isRealDate, todayInWarsaw } from "@/lib/dates";
import { AMOUNT_ERROR, parseAmountToMinor } from "@/lib/money";
import {
  DAY_OF_MONTH_ERROR,
  MAX_DAY_OF_MONTH,
  MAX_HORIZON_MONTHS,
  MIN_DAY_OF_MONTH,
  MIN_MONTHS,
  MONTHS_ERROR,
} from "@/lib/recurring-limits";
import { INCOME_SOURCES } from "@/types";

const DATE_ERROR = "Podaj poprawną datę";
const FUTURE_DATE_ERROR = "Data nie może być z przyszłości";
const DESCRIPTION_ERROR = "Opis może mieć maksymalnie 200 znaków";

/** Raw text typed by the user ("12,50"); this is the only place it is converted to grosze. */
export const amountField = z.string("Podaj kwotę").transform((value, ctx) => {
  const minor = parseAmountToMinor(value);
  if (minor === null) {
    ctx.addIssue({ code: "custom", message: AMOUNT_ERROR });
    return z.NEVER;
  }
  return minor;
});

/** YYYY-MM-DD, a real calendar date, not later than today in Warsaw. */
export const dateField = z
  .string(DATE_ERROR)
  .refine(isRealDate, DATE_ERROR)
  .refine((value) => value <= todayInWarsaw(), FUTURE_DATE_ERROR);

export const descriptionField = z.string(DESCRIPTION_ERROR).trim().max(200, DESCRIPTION_ERROR);

/** Day of the month an entry falls on; the database clamps it to the length of shorter months. */
export const dayOfMonthField = z
  .number("Podaj dzień miesiąca")
  .int("Podaj dzień miesiąca")
  .min(MIN_DAY_OF_MONTH, DAY_OF_MONTH_ERROR)
  .max(MAX_DAY_OF_MONTH, DAY_OF_MONTH_ERROR);

/** Number of months to create or to append; the database also limits the horizon to 24 months ahead. */
export const monthsField = z
  .number("Podaj liczbę miesięcy")
  .int("Podaj liczbę miesięcy")
  .min(MIN_MONTHS, MONTHS_ERROR)
  .max(MAX_HORIZON_MONTHS, MONTHS_ERROR);

/** Same bounds as the database check (1-50 characters, no surrounding whitespace). */
export const categoryNameField = z
  .string("Podaj nazwę kategorii")
  .trim()
  .min(1, "Podaj nazwę kategorii")
  .max(50, "Nazwa może mieć maksymalnie 50 znaków");

export const expenseCreateSchema = z.object({
  amount: amountField,
  categoryId: z.uuid("Wybierz kategorię"),
  date: dateField.optional(),
  description: descriptionField.optional(),
});

export const incomeCreateSchema = z.object({
  amount: amountField,
  source: z.enum(INCOME_SOURCES, "Wybierz źródło przychodu"),
  date: dateField.optional(),
});

/** Edit of an expense: the amount is always sent, the rest only when it changes (an entry from a cycle sends just the amount and description). */
export const expensePatchSchema = z.object({
  amount: amountField,
  categoryId: z.uuid("Wybierz kategorię").optional(),
  date: dateField.optional(),
  description: descriptionField.optional(),
});

export const incomePatchSchema = z.object({
  amount: amountField,
  source: z.enum(INCOME_SOURCES, "Wybierz źródło przychodu").optional(),
  date: dateField.optional(),
});
