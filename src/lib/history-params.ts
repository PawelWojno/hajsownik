import { z } from "zod";
import { currentMonthStart, parseMonthParam } from "@/lib/dates";
import type { HistoryQuery } from "@/lib/services/entries";

export type HistoryTab = "wydatki" | "przychody";

export interface HistoryParams {
  typ: HistoryTab;
  /** First day of the month, YYYY-MM-01. */
  month: string;
  categoryId: string | undefined;
}

/** Query string of the history page and API; a bad or missing value falls back to the default. */
export function parseHistoryParams(search: URLSearchParams): HistoryParams {
  const typ = z.enum(["wydatki", "przychody"]).catch("wydatki").parse(search.get("typ"));
  const categoryId = z.uuid().safeParse(search.get("kategoria"));
  return {
    typ,
    month: parseMonthParam(search.get("month")) ?? currentMonthStart(),
    // The category filter exists on the expenses tab only.
    categoryId: typ === "wydatki" && categoryId.success ? categoryId.data : undefined,
  };
}

export function toHistoryQuery(params: HistoryParams): HistoryQuery {
  return { kind: params.typ === "wydatki" ? "expense" : "income", month: params.month, categoryId: params.categoryId };
}
