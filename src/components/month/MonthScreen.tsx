import { useState } from "react";
import { Plus } from "lucide-react";
import { EntrySheet, type EntryMode } from "@/components/month/EntrySheet";
import { Button } from "@/components/ui/button";
import { formatMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Category, MonthSummary } from "@/types";

interface Props {
  monthLabel: string;
  initialSummary: MonthSummary;
  categories: Category[];
}

export default function MonthScreen({ monthLabel, initialSummary, categories }: Props) {
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
      <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-3xl font-bold text-transparent">
        {monthLabel}
      </h1>

      <section
        aria-live="polite"
        className="rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-xl"
      >
        <dl className="space-y-3">
          <Row label="Przychody" value={formatMinor(summary.incomeTotal)} />
          <Row label="Wydatki" value={formatMinor(summary.expenseTotal)} />
          <div className="border-t border-white/10 pt-3">
            <Row
              label="Zostaje"
              value={formatMinor(summary.left)}
              emphasis
              valueClass={summary.left < 0 ? "text-red-300" : "text-emerald-300"}
            />
          </div>
        </dl>
      </section>

      <div className="flex flex-col items-center gap-3">
        <Button
          type="button"
          onClick={() => {
            openSheet("expense");
          }}
          className="min-h-14 w-full rounded-xl bg-purple-600 text-lg font-semibold text-white hover:bg-purple-500"
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
          className="min-h-11 text-purple-300 hover:bg-white/10 hover:text-purple-100"
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
      <dt className={cn("text-blue-100/80", emphasis && "text-lg font-semibold text-white")}>{label}</dt>
      <dd className={cn("tabular-nums", emphasis ? "text-2xl font-bold" : "text-lg", valueClass)}>{value}</dd>
    </div>
  );
}
