import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { useRecurringActions } from "@/hooks/useRecurringActions";
import { formatMinor } from "@/lib/money";
import type { RecurringExpense } from "@/types";

/** The banner only shows while 0 or 1 month is left, so a year always fits under the 24-month limit. */
const EXTEND_MONTHS = 12;

interface Props {
  /** The full list: every answer of the API replaces it, so the banner filters `remind` itself. */
  initialItems: RecurringExpense[];
}

function endsIn(item: RecurringExpense): string {
  return item.monthsLeft === 0 ? "kończy się w tym miesiącu" : "kończy się za 1 mies.";
}

/** Reminder that a recurring expense is about to run out of generated entries (PRD FR-014). Renders nothing otherwise. */
export function RecurringReminders({ initialItems }: Props) {
  const { items, pending, error, extend, dismissReminder } = useRecurringActions(initialItems);
  const due = items.filter((item) => item.remind);

  if (due.length === 0) return null;

  return (
    <section aria-label="Cykliczne wydatki: koniec horyzontu" className="flex flex-col gap-2">
      {due.map((item) => (
        <div key={item.id} className="rounded-xl border border-amber-300/30 bg-amber-900/20 p-3 text-amber-100">
          <p className="text-sm">
            <span className="font-semibold">
              {item.categoryName}, {formatMinor(item.amountMinor)}, dzień {item.dayOfMonth}:
            </span>{" "}
            {endsIn(item)}. Przedłuż albo pozwól wygasnąć.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => void extend(item.id, EXTEND_MONTHS)}
              className="min-h-11 bg-purple-600 text-white hover:bg-purple-500"
            >
              Przedłuż o {EXTEND_MONTHS} mies.
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => void dismissReminder(item.id)}
              className="min-h-11 text-amber-100 hover:bg-white/10 hover:text-white"
            >
              Nie przypominaj
            </Button>
          </div>
          <ServerError message={error?.target === item.id ? error.message : null} />
        </div>
      ))}
    </section>
  );
}
