// Money is stored and transported as integer minor units (grosze); only these helpers convert to and from text.

export const MAX_AMOUNT_MINOR = 9_999_999_999;

const AMOUNT_PATTERN = /^(\d{1,8})(?:\.(\d{1,2}))?$/;

/** Parses what a user typed ("12,50", "12.5", "1 250") into grosze. Returns null unless the amount is valid and > 0. */
export function parseAmountToMinor(input: string): number | null {
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) return null;

  const [, whole, fraction = ""] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minor > 0 && minor <= MAX_AMOUNT_MINOR ? minor : null;
}

const plnFormatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

export function formatMinor(minor: number): string {
  return plnFormatter.format(minor / 100);
}
