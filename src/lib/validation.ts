import { z } from "zod";
import { isRealDate, todayInWarsaw } from "@/lib/dates";
import { parseAmountToMinor } from "@/lib/money";

export const AMOUNT_ERROR = "Podaj kwotę większą od zera, np. 12,50";
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
