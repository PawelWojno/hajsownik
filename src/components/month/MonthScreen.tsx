import { useState } from "react";
import { Plus } from "lucide-react";
import { EntrySheet, type EntryMode } from "@/components/month/EntrySheet";
import { RecurringIncomeReminders } from "@/components/month/RecurringIncomeReminders";
import { RecurringReminders } from "@/components/month/RecurringReminders";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Category, MonthSummary, RecurringExpense, RecurringIncome } from "@/types";

interface Props {
  monthLabel: string;
  /** The title links to the history of the current month. */
  historyHref: string;
  initialSummary: MonthSummary;
  categories: Category[];
  /** All recurring expenses; the reminder banner picks the ones whose horizon is about to end. */
  recurring: RecurringExpense[];
  /** All recurring incomes; their banner works the same way. */
  recurringIncomes: RecurringIncome[];
}

export default function MonthScreen({
  monthLabel,
  historyHref,
  initialSummary,
  categories,
  recurring,
  recurringIncomes,
}: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [mode, setMode] = useState<EntryMode>("expense");
  const [open, setOpen] = useState(false);

  function openSheet(next: EntryMode) {
    setMode(next);
    setOpen(true);
  }

  // data-category-ids: the category buttons exist only while the panel is open, so the smoke test reads the ids here.
  return (
    <div
      className="mx-auto flex w-full max-w-md flex-col gap-6"
      data-category-ids={categories.map((category) => category.id).join(",")}
    >
      <h1 className="from-title-from to-title-to bg-gradient-to-r bg-clip-text text-center text-3xl font-bold text-transparent">
        <a href={historyHref} className="block min-h-11 hover:underline">
          {monthLabel}
        </a>
      </h1>

      <RecurringReminders initialItems={recurring} />
      <RecurringIncomeReminders initialItems={recurringIncomes} />

      <Card aria-live="polite" className="gap-0 rounded-2xl p-6 shadow-none backdrop-blur-xl">
        <dl className="space-y-3">
          <Row label="Przychody" value={formatMinor(summary.incomeTotal)} />
          <Row label="Wydatki" value={formatMinor(summary.expenseTotal)} />
          <div className="border-border border-t pt-3">
            <Row
              label="Zostaje"
              value={formatMinor(summary.left)}
              emphasis
              valueClass={summary.left < 0 ? "text-destructive" : "text-success"}
            />
          </div>
        </dl>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            openSheet("expense");
          }}
          className="min-h-14 w-full rounded-xl text-lg font-semibold"
        >
          <Plus className="size-5" />
          Dodaj wydatek
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            openSheet("income");
          }}
          className="text-link hover:text-link-hover min-h-11"
        >
          <Plus className="size-4" />
          Dodaj przychód
        </Button>
      </div>

      <EntrySheet
        open={open}
        mode={mode}
        categories={categories}
        left={summary.left}
        onOpenChange={setOpen}
        onSaved={setSummary}
      />
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  emphasis?: boolean;
  valueClass?: string;
}

function Row({ label, value, emphasis, valueClass }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn("text-muted-foreground", emphasis && "text-foreground text-lg font-semibold")}>{label}</dt>
      <dd className={cn("tabular-nums", emphasis ? "text-2xl font-bold" : "text-lg", valueClass)}>{value}</dd>
    </div>
  );
}
