import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { EntrySheet } from "@/components/month/EntrySheet";
import { Button } from "@/components/ui/button";
import { useHistoryActions } from "@/hooks/useHistoryActions";
import { formatMonthLabel, monthStartOf } from "@/lib/dates";
import type { HistoryParams } from "@/lib/history-params";
import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { HistoryEntry, HistoryResponse, ManagedCategory } from "@/types";

interface Props {
  initial: HistoryResponse;
  params: HistoryParams;
  categories: ManagedCategory[];
}

const actionClass = "min-h-11 text-purple-300 hover:bg-white/10 hover:text-purple-100";

/** DD.MM from a YYYY-MM-DD date; the month is already in the page title. */
function shortDate(date: string): string {
  return `${date.slice(8)}.${date.slice(5, 7)}`;
}

interface DeleteControlProps {
  /** What the confirmation says; an entry from a cycle explains that the cycle goes on. */
  question: string;
  pending: boolean;
  onConfirm: () => Promise<boolean>;
  /** Called when the user backs out, so an error from a failed attempt does not linger. */
  onCancel: () => void;
}

/** "Usuń" asks for a second click in place (no browser dialog, which a user can block). A failed delete keeps asking. */
function DeleteControl({ question, pending, onConfirm, onCancel }: DeleteControlProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setConfirming(true);
        }}
        className="min-h-11 text-red-300 hover:bg-white/10 hover:text-red-200"
      >
        <Trash2 className="size-4" />
        Usuń
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Potwierdź usunięcie" className="flex w-full flex-wrap items-center gap-1">
      <span className="text-sm whitespace-pre-line text-red-200">{question}</span>
      <Button
        type="button"
        disabled={pending}
        onClick={() => void onConfirm()}
        className="min-h-11 bg-red-600 text-white hover:bg-red-500"
      >
        Tak, usuń
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setConfirming(false);
          onCancel();
        }}
        className={actionClass}
      >
        Anuluj
      </Button>
    </div>
  );
}

export default function HistoryList({ initial, params, categories }: Props) {
  const { entries, summary, truncated, pending, error, clearError, remove, refresh } = useHistoryActions(
    initial,
    params,
  );
  // `editing` stays set while the panel closes, so its content does not change during the closing animation.
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [moved, setMoved] = useState<string | null>(null);

  function startEdit(entry: HistoryEntry) {
    clearError();
    setMoved(null);
    setEditing(entry);
    setSheetOpen(true);
  }

  async function handleEdited(date: string) {
    await refresh();
    // An edit that moved the entry to another month removes it from this list: say where it went.
    setMoved(monthStartOf(date) === params.month ? null : `Przeniesiono: ${formatMonthLabel(date)}`);
  }

  // The panel offers the active categories plus the one the entry already has, even when that one is archived.
  const editableCategories = categories.filter((category) => !category.archived || category.id === editing?.categoryId);

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

      {moved && (
        <p role="status" className="text-center text-sm text-emerald-300">
          {moved}
        </p>
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
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    startEdit(entry);
                  }}
                  className={actionClass}
                >
                  <Pencil className="size-4" />
                  Edytuj
                </Button>
                <DeleteControl
                  question={entry.recurring ? "Na pewno?\nNie zatrzymuje cyklu." : "Na pewno? Nie można cofnąć."}
                  pending={pending}
                  onConfirm={() => remove(entry)}
                  onCancel={clearError}
                />
              </div>
              <ServerError message={error?.target === entry.id ? error.message : null} />
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="text-center text-sm text-blue-100/70">Pokazano 200 wpisów — zawęź filtr kategorii.</p>
      )}

      <EntrySheet
        open={sheetOpen}
        mode={editing?.kind ?? "expense"}
        entry={editing ?? undefined}
        categories={editableCategories}
        onOpenChange={setSheetOpen}
        onEdited={(date) => void handleEdited(date)}
      />
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
