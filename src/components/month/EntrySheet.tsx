import { useEffect, useRef, useState } from "react";
import type { MouseEvent, SubmitEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { CategoryGrid } from "@/components/month/CategoryGrid";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useEntrySubmit } from "@/hooks/useEntrySubmit";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatMonthLabel, todayInWarsaw } from "@/lib/dates";
import { AMOUNT_ERROR, filterAmountInput, formatMinor, parseAmountToMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { INCOME_SOURCES, type Category, type IncomeSource, type MonthSummary } from "@/types";

export type EntryMode = "expense" | "income";

const fieldClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none";

interface SheetProps {
  open: boolean;
  mode: EntryMode;
  categories: Category[];
  /** Current "zostaje", repeated in the header because the panel can cover the sums on a phone. */
  left: number;
  onOpenChange: (open: boolean) => void;
  onSaved: (summary: MonthSummary) => void;
}

/** Bottom sheet on phones, side panel from `md` up. Closes on X, swipe, Esc and a tap on the backdrop. */
export function EntrySheet({ open, mode, categories, left, onOpenChange, onSaved }: SheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={isDesktop ? "right" : "bottom"}>
      <DrawerContent
        className="border-white/10 bg-slate-900 text-white data-[vaul-drawer-direction=bottom]:max-h-[70dvh] data-[vaul-drawer-direction=right]:sm:max-w-sm"
        // The form focuses the amount field itself; stop the dialog from focusing the close button first.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        // The native date picker is a separate popup that takes focus away from the panel; that must not close it.
        // Tapping the backdrop still closes it (pointer-down-outside is a different event).
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DrawerHeader className="flex-row items-center justify-between pb-2">
          <div className="text-left">
            <DrawerTitle className="text-lg text-white">
              {mode === "expense" ? "Dodaj wydatek" : "Dodaj przychód"}
            </DrawerTitle>
            <DrawerDescription className="text-blue-100/70">
              Zostaje w tym miesiącu: <span className="font-semibold text-white tabular-nums">{formatMinor(left)}</span>
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" aria-label="Zamknij" className="text-white hover:bg-white/10">
              <X className="size-5" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        <EntryForm key={mode} mode={mode} categories={categories} onSaved={onSaved} />
      </DrawerContent>
    </Drawer>
  );
}

interface FormProps {
  mode: EntryMode;
  categories: Category[];
  onSaved: (summary: MonthSummary) => void;
}

/** A click anywhere in a date field opens the calendar (by default only the small icon does). */
function openDatePicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker();
  } catch {
    // Not supported or not allowed here: the field still works by typing or through its own icon.
  }
}

function EntryForm({ mode, categories, onSaved }: FormProps) {
  const today = todayInWarsaw();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [source, setSource] = useState<IncomeSource>(INCOME_SOURCES[0]);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { submit, pending } = useEntrySubmit();

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const minor = parseAmountToMinor(amount);
    if (minor === null) {
      setError(AMOUNT_ERROR);
      return;
    }
    if (mode === "expense" && !categoryId) {
      setError("Wybierz kategorię");
      return;
    }

    // The raw text is sent as typed; the API is the only place that converts it to grosze.
    const payload: Record<string, string> = { amount };
    if (date) payload.date = date;
    if (mode === "expense") {
      payload.categoryId = categoryId ?? "";
      if (description.trim()) payload.description = description;
    } else {
      payload.source = source;
    }

    setError(null);
    const result = await submit(mode === "expense" ? "expenses" : "incomes", payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSaved(result.data.summary);
    const label = mode === "expense" ? categories.find((c) => c.id === categoryId)?.name : source;
    setNotice(
      result.data.inCurrentMonth
        ? `Zapisano ${formatMinor(minor)} · ${label ?? ""}`
        : `Zapisano (${formatMonthLabel(date)}) — nie wpływa na ten miesiąc`,
    );

    // Quick entry: back to an empty form, ready for the next one.
    setAmount("");
    setCategoryId(null);
    setDescription("");
    setDate(today);
    setShowMore(false);
    amountRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
      <div>
        <label htmlFor="amount" className="mb-1 block text-sm text-blue-100/80">
          Kwota (zł)
        </label>
        <input
          ref={amountRef}
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={amount}
          onChange={(event) => {
            setAmount(filterAmountInput(event.target.value));
            setError(null);
          }}
          className={cn(fieldClass, "text-2xl")}
        />
      </div>

      {mode === "expense" ? (
        <CategoryGrid
          categories={categories}
          selectedId={categoryId}
          onSelect={(id) => {
            setCategoryId(id);
            setError(null);
          }}
        />
      ) : (
        <div>
          <label htmlFor="source" className="mb-1 block text-sm text-blue-100/80">
            Źródło
          </label>
          <select
            id="source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value as IncomeSource);
            }}
            className={cn(fieldClass, "min-h-11")}
          >
            {INCOME_SOURCES.map((value) => (
              <option key={value} value={value} className="text-black">
                {value}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => {
            setShowMore(!showMore);
          }}
          className="flex min-h-11 items-center gap-1 text-sm text-purple-300 hover:text-purple-100"
        >
          Więcej opcji
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} />
        </button>
        {showMore && (
          <div className="mt-2 flex flex-col gap-3">
            <div>
              <label htmlFor="date" className="mb-1 block text-sm text-blue-100/80">
                Data
              </label>
              <input
                id="date"
                type="date"
                max={today}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                }}
                onClick={openDatePicker}
                // color-scheme: dark makes the browser draw the calendar icon and the picker for a dark background.
                className={cn(fieldClass, "min-h-11 [color-scheme:dark]")}
              />
            </div>
            {mode === "expense" && (
              <div>
                <label htmlFor="description" className="mb-1 block text-sm text-blue-100/80">
                  Opis (opcjonalnie)
                </label>
                <input
                  id="description"
                  type="text"
                  maxLength={200}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  className={fieldClass}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ServerError message={error} />
      <p role="status" className="min-h-5 text-sm text-emerald-300">
        {notice}
      </p>

      <Button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500"
      >
        {pending ? "Zapisuję…" : "Zapisz"}
      </Button>
    </form>
  );
}
