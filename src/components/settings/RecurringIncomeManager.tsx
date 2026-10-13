import { useState } from "react";
import type { SubmitEvent } from "react";
import { Check, CircleAlert, Pencil, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { ADD_TARGET, useRecurringIncomeActions } from "@/hooks/useRecurringIncomeActions";
import { formatMonthLabel } from "@/lib/dates";
import { AMOUNT_ERROR, filterAmountInput, formatMinor, formatMinorForInput, parseAmountToMinor } from "@/lib/money";
import { MAX_DAY_OF_MONTH, MAX_HORIZON_MONTHS, MIN_DAY_OF_MONTH, MIN_MONTHS } from "@/lib/recurring-limits";
import { cn } from "@/lib/utils";
import { INCOME_SOURCES } from "@/types";
import type { RecurringIncome } from "@/types";

const fieldClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none";
const actionClass = "min-h-11 min-w-11 text-purple-300 hover:bg-white/10 hover:text-purple-100";
const labelClass = "text-sm text-blue-100/80";
/** Same error look as FormField in the auth forms: red border and ring. */
const errorFieldClass = "border-red-400/60 focus:ring-red-400";

const EXTEND_STEP = 12;

interface Props {
  initialItems: RecurringIncome[];
  /** Today's day of the month in Warsaw, computed on the server so it matches the hydrated form. */
  defaultDay: number;
}

/** How many months "Przedłuż" appends: a year, or less when that would pass the limit of 24 months from the current. */
function extendBy(item: RecurringIncome): number {
  return Math.min(EXTEND_STEP, MAX_HORIZON_MONTHS - 1 - item.monthsLeft);
}

interface AddForm {
  amount: string;
  source: string;
  day: string;
  months: string;
}

/** Only the typed amount can be wrong: source, day and months are picked from lists of valid values. */
interface FieldErrors {
  amount?: string;
}

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

const DAY_OPTIONS = range(MIN_DAY_OF_MONTH, MAX_DAY_OF_MONTH);
const MONTH_OPTIONS = range(MIN_MONTHS, MAX_HORIZON_MONTHS);

/**
 * Checks what the user can get wrong before sending, so each message shows under its own field instead of the
 * browser's validation bubble. The server still validates everything: this only saves a round trip.
 */
function validateForm(form: AddForm): FieldErrors {
  const errors: FieldErrors = {};
  if (parseAmountToMinor(form.amount) === null) errors.amount = AMOUNT_ERROR;
  return errors;
}

/** Message under a field, same look as in FormField. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-center gap-1 text-xs text-red-300">
      <CircleAlert className="size-3 shrink-0" />
      {message}
    </p>
  );
}

interface StopControlProps {
  /** Source and amount, so a screen reader can tell the rows' buttons apart. */
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

export default function RecurringIncomeManager({ initialItems, defaultDay }: Props) {
  const { items, pending, error, clearError, add, changeAmount, extend, stop } =
    useRecurringIncomeActions(initialItems);
  const [form, setForm] = useState<AddForm>({
    amount: "",
    source: INCOME_SOURCES[0],
    day: String(defaultDay),
    months: "12",
  });
  const [editing, setEditing] = useState<{ id: string; amount: string } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /** Updates one field and clears its message, so the error disappears as soon as the user corrects it. */
  function updateForm(field: keyof AddForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleAdd(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const errors = validateForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const saved = await add({
      source: form.source,
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

  function renderAmount(item: RecurringIncome) {
    if (editing?.id !== item.id) {
      return <span className="font-semibold">{formatMinor(item.amountMinor)}</span>;
    }
    return (
      <form onSubmit={handleChangeAmount} className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        <input
          autoFocus
          inputMode="decimal"
          aria-label={`Nowa kwota: ${item.source}`}
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
        <p className="w-full text-xs text-red-300">Zmiana kwoty cyklu nadpisze przyszłe wpisy.</p>
      </form>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 text-white">
      <h1 className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-center text-3xl font-bold text-transparent">
        Cykliczne przychody
      </h1>

      <form onSubmit={handleAdd} noValidate className="flex flex-col gap-3">
        <p className="text-sm text-blue-100/70">
          Wpisy powstają od razu, po jednym na miesiąc, od bieżącego miesiąca. Nie dodajemy ich za miesiące, które już
          minęły.
        </p>

        <div className="flex flex-col gap-1">
          <label htmlFor="recurring-income-amount" className={labelClass}>
            Kwota
          </label>
          <input
            id="recurring-income-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="np. 4200,00"
            value={form.amount}
            aria-invalid={fieldErrors.amount ? true : undefined}
            aria-describedby={fieldErrors.amount ? "recurring-income-amount-error" : undefined}
            onChange={(event) => {
              updateForm("amount", filterAmountInput(event.target.value));
            }}
            className={cn(fieldClass, "min-h-11", fieldErrors.amount && errorFieldClass)}
          />
          <FieldError id="recurring-income-amount-error" message={fieldErrors.amount} />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="recurring-income-source" className={labelClass}>
            Źródło
          </label>
          <select
            id="recurring-income-source"
            value={form.source}
            onChange={(event) => {
              updateForm("source", event.target.value);
            }}
            className={cn(fieldClass, "min-h-11")}
          >
            {INCOME_SOURCES.map((source) => (
              <option key={source} value={source} className="text-black">
                {source}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="recurring-income-day" className={labelClass}>
              Dzień miesiąca
            </label>
            <select
              id="recurring-income-day"
              value={form.day}
              onChange={(event) => {
                updateForm("day", event.target.value);
              }}
              className={cn(fieldClass, "min-h-11")}
            >
              {DAY_OPTIONS.map((day) => (
                <option key={day} value={day} className="text-black">
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="recurring-income-months" className={labelClass}>
              Liczba miesięcy
            </label>
            <select
              id="recurring-income-months"
              value={form.months}
              onChange={(event) => {
                updateForm("months", event.target.value);
              }}
              className={cn(fieldClass, "min-h-11")}
            >
              {MONTH_OPTIONS.map((months) => (
                <option key={months} value={months} className="text-black">
                  {months}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-white/50">W krótszych miesiącach wpis wypada ostatniego dnia (np. 28 lutego).</p>

        <Button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-lg bg-purple-600 px-4 font-medium text-white hover:bg-purple-500"
        >
          Dodaj
        </Button>
        <ServerError message={error?.target === ADD_TARGET ? error.message : null} />
      </form>

      <section aria-labelledby="recurring-income-heading" className="flex flex-col gap-2">
        <h2 id="recurring-income-heading" className="text-lg font-semibold">
          Twoje cykliczne przychody
        </h2>
        <p className="text-sm text-blue-100/70">
          Zmiana kwoty dotyczy tylko przyszłych wpisów. Wpisy z dzisiejszą lub wcześniejszą datą zostają bez zmian.
        </p>
        {items.length === 0 && <p className="text-sm text-white/60">Nie masz jeszcze cyklicznych przychodów.</p>}
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const lapsed = item.monthsLeft < 0;
            const extendMonths = extendBy(item);
            const canExtend = extendMonths >= 1;
            const itemLabel = `${item.source}, ${formatMinor(item.amountMinor)}`;
            return (
              <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 break-words">{item.source}</span>
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
                      aria-label={`Zmień kwotę: ${item.source}`}
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
