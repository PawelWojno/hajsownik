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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEntrySubmit } from "@/hooks/useEntrySubmit";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatMonthLabel, todayInWarsaw } from "@/lib/dates";
import { AMOUNT_ERROR, filterAmountInput, formatMinor, formatMinorForInput, parseAmountToMinor } from "@/lib/money";
import { cn } from "@/lib/utils";
import { INCOME_SOURCES, type Category, type HistoryEntry, type IncomeSource, type MonthSummary } from "@/types";

export type EntryMode = "expense" | "income";

/** The select hands back a plain string; only a known income source is accepted. */
function parseIncomeSource(value: string): IncomeSource | undefined {
  return INCOME_SOURCES.find((source) => source === value);
}

interface SheetProps {
  open: boolean;
  mode: EntryMode;
  categories: Category[];
  /** Current "zostaje", repeated in the header because the panel can cover the sums on a phone. Not used when editing. */
  left?: number;
  /** When set, the panel edits this entry instead of adding a new one (`mode` is then ignored). */
  entry?: HistoryEntry;
  onOpenChange: (open: boolean) => void;
  onSaved?: (summary: MonthSummary) => void;
  /** Called after a saved edit with the entry's date (YYYY-MM-DD), so the list can tell if it left the month. */
  onEdited?: (date: string) => void;
}

/** Bottom sheet on phones, side panel from `md` up. Closes on X, swipe, Esc and a tap on the backdrop. */
export function EntrySheet({ open, mode, categories, left, entry, onOpenChange, onSaved, onEdited }: SheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    // repositionInputs={false}: vaul's own on-screen-keyboard logic writes inline height/bottom styles and, on Android,
    // loses track of the keyboard closing (a blank band the height of the keyboard stays over the panel). The browser
    // resizes the layout for the keyboard instead (see interactive-widget in Layout.astro).
    <Drawer open={open} onOpenChange={onOpenChange} direction={isDesktop ? "right" : "bottom"} repositionInputs={false}>
      <DrawerContent
        className="border-border bg-popover text-popover-foreground data-[vaul-drawer-direction=bottom]:max-h-[70dvh] data-[vaul-drawer-direction=right]:sm:max-w-sm"
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
            <DrawerTitle className="text-lg">
              {entry ? "Edytuj wpis" : mode === "expense" ? "Dodaj wydatek" : "Dodaj przychód"}
            </DrawerTitle>
            {entry || left === undefined ? (
              <DrawerDescription className="sr-only">{entry?.label}</DrawerDescription>
            ) : (
              <DrawerDescription>
                Zostaje w tym miesiącu:{" "}
                <span className="text-foreground font-semibold tabular-nums">{formatMinor(left)}</span>
              </DrawerDescription>
            )}
          </div>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" aria-label="Zamknij" className="min-h-11 min-w-11">
              <X className="size-5" />
            </Button>
          </DrawerClose>
        </DrawerHeader>
        {entry ? (
          <EditForm
            key={entry.id}
            entry={entry}
            categories={categories}
            onDone={(date) => {
              onOpenChange(false);
              onEdited?.(date);
            }}
          />
        ) : (
          <EntryForm key={mode} mode={mode} categories={categories} onSaved={onSaved} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

interface FormProps {
  mode: EntryMode;
  categories: Category[];
  onSaved?: (summary: MonthSummary) => void;
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

    const label = mode === "expense" ? categories.find((c) => c.id === categoryId)?.name : source;
    if (result.data.summary === null) {
      // Saved, but the sums are stale: say so, otherwise the user would retry and double the entry.
      setNotice("Zapisano, ale nie udało się odświeżyć sum. Odśwież stronę.");
    } else {
      onSaved?.(result.data.summary);
      setNotice(
        result.data.inCurrentMonth
          ? `Zapisano ${formatMinor(minor)} · ${label ?? ""}`
          : `Zapisano (${formatMonthLabel(date)}) — nie wpływa na ten miesiąc`,
      );
    }

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
        <Label htmlFor="amount" className="text-muted-foreground mb-1 font-normal">
          Kwota (zł)
        </Label>
        <Input
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
          className="dark:bg-card h-auto py-2 text-2xl md:text-2xl"
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
          <Label htmlFor="source" className="text-muted-foreground mb-1 font-normal">
            Źródło
          </Label>
          <Select
            value={source}
            onValueChange={(value) => {
              setSource(parseIncomeSource(value) ?? source);
            }}
          >
            <SelectTrigger id="source" className="dark:bg-card min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            {/* popper: the list opens under the field instead of over it, which suits a panel on a phone. */}
            <SelectContent position="popper">
              {INCOME_SOURCES.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => {
            setShowMore(!showMore);
          }}
          className="text-link hover:text-link-hover focus-visible:ring-ring/50 flex min-h-11 items-center gap-1 rounded-md text-sm outline-none focus-visible:ring-3"
        >
          Więcej opcji
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} />
        </button>
        {showMore && (
          <div className="mt-2 flex flex-col gap-3">
            <div>
              <Label htmlFor="date" className="text-muted-foreground mb-1 font-normal">
                Data
              </Label>
              <Input
                id="date"
                type="date"
                max={today}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                }}
                onClick={openDatePicker}
                className="dark:bg-card min-h-11"
              />
            </div>
            {mode === "expense" && (
              <div>
                <Label htmlFor="description" className="text-muted-foreground mb-1 font-normal">
                  Opis (opcjonalnie)
                </Label>
                <Input
                  id="description"
                  type="text"
                  autoComplete="off"
                  maxLength={200}
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                  }}
                  className="dark:bg-card min-h-11"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ServerError message={error} />
      <p role="status" className="text-success min-h-5 text-sm">
        {notice}
      </p>

      <Button type="submit" disabled={pending} className="min-h-11 w-full rounded-lg">
        {pending ? "Zapisuję…" : "Zapisz"}
      </Button>
    </form>
  );
}

interface EditFormProps {
  entry: HistoryEntry;
  categories: Category[];
  onDone: (date: string) => void;
}

/** DD.MM.YYYY from a YYYY-MM-DD date, for the read-only fields of an entry from a cycle. */
function longDate(date: string): string {
  return `${date.slice(8)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

/**
 * Edit form of one entry. An entry from a cycle keeps its date and category (the database enforces it), so those are
 * shown as text; its amount, and the description of an expense, can change.
 */
function EditForm({ entry, categories, onDone }: EditFormProps) {
  const today = todayInWarsaw();
  const isExpense = entry.kind === "expense";
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(formatMinorForInput(entry.amountMinor));
  const [categoryId, setCategoryId] = useState<string | null>(entry.categoryId);
  const [source, setSource] = useState<IncomeSource>(
    INCOME_SOURCES.find((value) => value === entry.label) ?? INCOME_SOURCES[0],
  );
  const [date, setDate] = useState(entry.date);
  const [description, setDescription] = useState(entry.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const { edit, pending } = useEntrySubmit();

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (parseAmountToMinor(amount) === null) {
      setError(AMOUNT_ERROR);
      return;
    }
    if (isExpense && !entry.recurring && !categoryId) {
      setError("Wybierz kategorię");
      return;
    }

    // The raw text is sent as typed; the API converts it to grosze. An entry from a cycle sends only what may change.
    const payload: Record<string, string> = { amount };
    if (isExpense) payload.description = description;
    if (!entry.recurring) {
      if (date) payload.date = date;
      if (isExpense) payload.categoryId = categoryId ?? "";
      else payload.source = source;
    }

    setError(null);
    const result = await edit(isExpense ? "expenses" : "incomes", entry.id, payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(entry.recurring ? entry.date : date || entry.date);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
      <div>
        <Label htmlFor="amount" className="text-muted-foreground mb-1 font-normal">
          Kwota (zł)
        </Label>
        <Input
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
          className="dark:bg-card h-auto py-2 text-2xl md:text-2xl"
        />
      </div>

      {entry.recurring ? (
        <dl className="border-border bg-card space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Data</dt>
            <dd>{longDate(entry.date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{isExpense ? "Kategoria" : "Źródło"}</dt>
            <dd className="text-right break-words">{entry.label}</dd>
          </div>
        </dl>
      ) : (
        <>
          {isExpense ? (
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
              <Label htmlFor="source" className="text-muted-foreground mb-1 font-normal">
                Źródło
              </Label>
              <Select
                value={source}
                onValueChange={(value) => {
                  setSource(parseIncomeSource(value) ?? source);
                }}
              >
                <SelectTrigger id="source" className="dark:bg-card min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                {/* popper: the list opens under the field instead of over it, which suits a panel on a phone. */}
                <SelectContent position="popper">
                  {INCOME_SOURCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="date" className="text-muted-foreground mb-1 font-normal">
              Data
            </Label>
            <Input
              id="date"
              type="date"
              max={today}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
              }}
              onClick={openDatePicker}
              className="dark:bg-card min-h-11"
            />
          </div>
        </>
      )}

      {isExpense && (
        <div>
          <Label htmlFor="description" className="text-muted-foreground mb-1 font-normal">
            Opis (opcjonalnie)
          </Label>
          <Input
            id="description"
            type="text"
            autoComplete="off"
            maxLength={200}
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className="dark:bg-card min-h-11"
          />
        </div>
      )}

      <ServerError message={error} />

      <Button type="submit" disabled={pending} className="min-h-11 w-full rounded-lg">
        {pending ? "Zapisuję…" : "Zapisz"}
      </Button>
    </form>
  );
}
