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
      {due.map((item) => {
        const itemLabel = `${item.categoryName}, ${formatMinor(item.amountMinor)}`;
        return (
          <div key={item.id} className="border-warning-border bg-warning text-warning-foreground rounded-xl border p-3">
            <p className="text-sm">
              <span className="font-semibold">
                {item.categoryName}, {formatMinor(item.amountMinor)}, dzień {item.dayOfMonth}:
              </span>{" "}
              {endsIn(item)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={pending}
                aria-label={`Przedłuż o ${EXTEND_MONTHS} mies.: ${itemLabel}`}
                onClick={() => void extend(item.id, EXTEND_MONTHS)}
                className="min-h-11"
              >
                Przedłuż o {EXTEND_MONTHS} mies.
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                aria-label={`Nie przypominaj: ${itemLabel}`}
                onClick={() => void dismissReminder(item.id)}
                className="text-warning-foreground min-h-11"
              >
                Nie przypominaj
              </Button>
            </div>
            <ServerError message={error?.target === item.id ? error.message : null} />
          </div>
        );
      })}
    </section>
  );
}
