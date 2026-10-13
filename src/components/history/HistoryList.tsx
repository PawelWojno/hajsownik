import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { HistoryEntry, MonthSummary } from "@/types";

interface Props {
  entries: HistoryEntry[];
  summary: MonthSummary | null;
  truncated: boolean;
}

/** DD.MM from a YYYY-MM-DD date; the month is already in the page title. */
function shortDate(date: string): string {
  return `${date.slice(8)}.${date.slice(5, 7)}`;
}

export default function HistoryList({ entries, summary, truncated }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      {summary && (
        <section
          aria-live="polite"
          className="rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-xl"
        >
          <dl className="space-y-1">
            <SummaryRow label="Przychody" value={formatMinor(summary.incomeTotal)} />
            <SummaryRow label="Wydatki" value={formatMinor(summary.expenseTotal)} />
            <SummaryRow
              label="Zostaje"
              value={formatMinor(summary.left)}
              valueClass={summary.left < 0 ? "text-red-300" : "text-emerald-300"}
              emphasis
            />
          </dl>
        </section>
      )}

      {entries.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-6 text-center text-sm text-blue-100/70">
          Brak wpisów w tym miesiącu.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-white">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 font-medium break-words">
                  <span className="mr-2 text-blue-100/70 tabular-nums">{shortDate(entry.date)}</span>
                  {entry.label}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMinor(entry.amountMinor)}</span>
              </div>
              {entry.description && <p className="mt-1 text-sm break-words text-blue-100/70">{entry.description}</p>}
              {(entry.recurring || entry.planned || entry.categoryArchived) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {entry.recurring && <Pill>cykliczny</Pill>}
                  {entry.planned && <Pill>zaplanowany</Pill>}
                  {entry.categoryArchived && <Pill>zarchiwizowana</Pill>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="text-center text-sm text-blue-100/70">Pokazano 200 wpisów — zawęź filtr kategorii.</p>
      )}
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">{children}</span>;
}

interface RowProps {
  label: string;
  value: string;
  emphasis?: boolean;
  valueClass?: string;
}

function SummaryRow({ label, value, emphasis, valueClass }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-blue-100/80", emphasis && "font-semibold text-white")}>{label}</dt>
      <dd className={cn("tabular-nums", emphasis && "font-bold", valueClass)}>{value}</dd>
    </div>
  );
}
