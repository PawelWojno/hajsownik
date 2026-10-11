import { useState } from "react";
import type { SubmitEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { ADD_TARGET, useRecurringActions } from "@/hooks/useRecurringActions";
import { formatMonthLabel } from "@/lib/dates";
import { filterAmountInput, formatMinor, formatMinorForInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Category, RecurringExpense } from "@/types";

const fieldClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none";
const actionClass = "min-h-11 min-w-11 text-purple-300 hover:bg-white/10 hover:text-purple-100";
const labelClass = "text-sm text-blue-100/80";

/** The horizon covers at most this many months counting the current one (enforced by the database too). */
const MAX_HORIZON_MONTHS = 24;
const EXTEND_STEP = 12;

interface Props {
  initialItems: RecurringExpense[];
  /** Active categories only: an archived one is not offered for a new definition. */
  categories: Category[];
}

/** How many months "Przedłuż" appends: a year, or less when that would pass the limit of 24 months from the current. */
function extendBy(item: RecurringExpense): number {
  return Math.min(EXTEND_STEP, MAX_HORIZON_MONTHS - 1 - item.monthsLeft);
}

interface StopControlProps {
  /** Category and amount, so a screen reader can tell the rows' buttons apart. */
  itemLabel: string;
  pending: boolean;
  onConfirm: () => Promise<boolean>;
  /** Called when the user backs out, so an error from a failed attempt does not linger. */
  onCancel: () => void;
}

/** "Zatrzymaj" asks for a second click in place (no browser dialog, which a user can block). */
function StopControl({ itemLabel, pending, onConfirm, onCancel }: StopControlProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        aria-label={`Zatrzymaj: ${itemLabel}`}
        onClick={() => {
          setConfirming(true);
        }}
        className="min-h-11 text-red-300 hover:bg-white/10 hover:text-red-200"
      >
        Zatrzymaj
      </Button>
    );
  }

  return (
    <div role="group" aria-label={`Potwierdź zatrzymanie: ${itemLabel}`} className="flex flex-wrap items-center gap-1">
      <span className="text-sm text-red-200">Na pewno? Wygenerowane przyszłe wpisy zostaną usunięte.</span>
      <Button
        type="button"
        disabled={pending}
        onClick={() => void onConfirm()}
        className="min-h-11 bg-red-600 text-white hover:bg-red-500"
      >
        Tak, zatrzymaj
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

export default function RecurringManager({ initialItems, categories }: Props) {
  const { items, pending, error, clearError, add, changeAmount, extend, stop } = useRecurringActions(initialItems);
  const [form, setForm] = useState({ amount: "", categoryId: categories[0]?.id ?? "", day: "1", months: "12" });
  const [editing, setEditing] = useState<{ id: string; amount: string } | null>(null);

  async function handleAdd(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const saved = await add({
      categoryId: form.categoryId,
      amount: form.amount,
      dayOfMonth: Number(form.day),
      months: Number(form.months),
    });
    if (saved) setForm((current) => ({ ...current, amount: "" }));
  }

  async function handleChangeAmount(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !editing) return;
    if (await changeAmount(editing.id, editing.amount)) setEditing(null);
  }

  function renderAmount(item: RecurringExpense) {
    if (editing?.id !== item.id) {
      return <span className="font-semibold">{formatMinor(item.amountMinor)}</span>;
    }
    return (
      <form onSubmit={handleChangeAmount} className="flex min-w-0 flex-1 items-center gap-1">
        <input
          autoFocus
          inputMode="decimal"
          aria-label={`Nowa kwota: ${item.categoryName}`}
          value={editing.amount}
          onChange={(event) => {
            setEditing({ id: item.id, amount: filterAmountInput(event.target.value) });
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(null);
          }}
          className={cn(fieldClass, "min-h-11")}
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Zapisz kwotę"
          disabled={pending}
          className={actionClass}
        >
          <Check className="size-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Anuluj"
          onClick={() => {
            setEditing(null);
          }}
          className={actionClass}
        >
          <X className="size-5" />
        </Button>
      </form>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 text-white">
      <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-3xl font-bold text-transparent">
        Cykliczne wydatki
      </h1>

      <form onSubmit={handleAdd} className="flex flex-col gap-3">
        <p className="text-sm text-blue-100/70">
          Wpisy powstają od razu, po jednym na miesiąc, od bieżącego miesiąca. Nie dodajemy ich za miesiące, które już
          minęły.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="recurring-amount" className={labelClass}>
            Kwota
          </label>
          <input
            id="recurring-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="np. 1850,00"
            value={form.amount}
            onChange={(event) => {
              setForm((current) => ({ ...current, amount: filterAmountInput(event.target.value) }));
            }}
            className={cn(fieldClass, "min-h-11")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="recurring-category" className={labelClass}>
            Kategoria
          </label>
          <select
            id="recurring-category"
            value={form.categoryId}
            onChange={(event) => {
              setForm((current) => ({ ...current, categoryId: event.target.value }));
            }}
            className={cn(fieldClass, "min-h-11")}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id} className="text-black">
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="recurring-day" className={labelClass}>
              Dzień miesiąca
            </label>
            <input
              id="recurring-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={form.day}
              onChange={(event) => {
                setForm((current) => ({ ...current, day: event.target.value }));
              }}
              className={cn(fieldClass, "min-h-11")}
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="recurring-months" className={labelClass}>
              Liczba miesięcy
            </label>
            <input
              id="recurring-months"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_HORIZON_MONTHS}
              value={form.months}
              onChange={(event) => {
                setForm((current) => ({ ...current, months: event.target.value }));
              }}
              className={cn(fieldClass, "min-h-11")}
            />
          </div>
        </div>
        <p className="text-xs text-white/50">W krótszych miesiącach wpis wypada ostatniego dnia (np. 28 lutego).</p>

        <Button
          type="submit"
          disabled={pending || categories.length === 0}
          className="min-h-11 rounded-lg bg-purple-600 px-4 font-medium text-white hover:bg-purple-500"
        >
          Dodaj
        </Button>
        {categories.length === 0 && (
          <p className="text-sm text-white/60">Brak aktywnych kategorii. Dodaj kategorię w ustawieniach.</p>
        )}
        <ServerError message={error?.target === ADD_TARGET ? error.message : null} />
      </form>

      <section aria-labelledby="recurring-heading" className="flex flex-col gap-2">
        <h2 id="recurring-heading" className="text-lg font-semibold">
          Twoje cykliczne wydatki
        </h2>
        <p className="text-sm text-blue-100/70">
          Zmiana kwoty dotyczy tylko przyszłych wpisów. Wpisy z dzisiejszą lub wcześniejszą datą zostają bez zmian.
        </p>
        {items.length === 0 && <p className="text-sm text-white/60">Nie masz jeszcze cyklicznych wydatków.</p>}
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const lapsed = item.monthsLeft < 0;
            const extendMonths = extendBy(item);
            const canExtend = extendMonths >= 1;
            const itemLabel = `${item.categoryName}, ${formatMinor(item.amountMinor)}`;
            return (
              <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-words">{item.categoryName}</span>
                  {item.categoryArchived && (
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">
                      zarchiwizowana
                    </span>
                  )}
                  {lapsed && (
                    <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-xs text-amber-200">
                      Wygasła
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {renderAmount(item)}
                  {editing?.id !== item.id && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Zmień kwotę: ${item.categoryName}`}
                      disabled={pending}
                      onClick={() => {
                        setEditing({ id: item.id, amount: formatMinorForInput(item.amountMinor) });
                      }}
                      className={actionClass}
                    >
                      <Pencil className="size-5" />
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-sm text-blue-100/70">
                  Dzień {item.dayOfMonth}, od {formatMonthLabel(item.startMonth)} do {formatMonthLabel(item.endMonth)}
                </p>
                {editing?.id !== item.id && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={pending || !canExtend}
                      aria-label={canExtend ? `Przedłuż o ${extendMonths} mies.: ${itemLabel}` : undefined}
                      onClick={() => void extend(item.id, extendMonths)}
                      className="min-h-11 text-purple-300 hover:bg-white/10 hover:text-purple-100"
                    >
                      {canExtend ? `Przedłuż o ${extendMonths} mies.` : "Maksymalny horyzont"}
                    </Button>
                    <StopControl
                      itemLabel={itemLabel}
                      pending={pending}
                      onConfirm={() => stop(item.id)}
                      onCancel={clearError}
                    />
                  </div>
                )}
                {!canExtend && (
                  <p className="mt-1 text-xs text-white/50">
                    Horyzont obejmuje już 24 miesiące licząc od bieżącego, więc nie da się go przedłużyć.
                  </p>
                )}
                <ServerError message={error?.target === item.id ? error.message : null} />
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
