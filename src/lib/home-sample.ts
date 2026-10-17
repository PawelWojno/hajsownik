// Sample data for the home page carousel (the three slides draw from this one object). Classes are full token class
// names so Tailwind can see them; colors live only in src/styles/global.css.

export interface SampleCategory {
  name: string;
  /** Whole zloty. */
  amount: number;
  /** SVG fill class of the category color token. */
  fill: string;
}

export const sample = {
  /** Whole zloty; the slide texts and the flow are derived from these. */
  income: 12500,
  expense: 8200,
  left: 4300,
  categories: [
    { name: "Mieszkanie", amount: 3000, fill: "fill-category-housing" },
    { name: "Żywność", amount: 2000, fill: "fill-category-food" },
    { name: "Samochód", amount: 1400, fill: "fill-category-car" },
    { name: "Dzieci", amount: 900, fill: "fill-category-kids" },
    { name: "Rozrywka", amount: 500, fill: "fill-category-fun" },
    { name: "Inne", amount: 400, fill: "fill-category-other" },
  ] satisfies SampleCategory[],
  /** The expense shown being added on the first slide. */
  draft: { amount: "150,00", category: "Rozrywka" },
  /** Rows of the list under the lens on the third slide; a negative amount is an expense. */
  entries: [
    { label: "Zakupy spożywcze", amount: -250, fill: "fill-category-food" },
    { label: "Paliwo", amount: -180, fill: "fill-category-car" },
    { label: "Czynsz", amount: -1800, fill: "fill-category-housing" },
    { label: "Wynagrodzenie", amount: 10000, fill: "fill-success" },
    { label: "Kieszonkowe", amount: -100, fill: "fill-category-kids" },
    { label: "Kino", amount: -60, fill: "fill-category-fun" },
  ],
};

const NBSP = String.fromCharCode(160);

/** "12 500 zł": thousands separated with a non-breaking space (pl-PL leaves four digits ungrouped). */
export function formatZl(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const digits = String(Math.abs(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${digits}${NBSP}zł`;
}
