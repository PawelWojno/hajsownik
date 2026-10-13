import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { MAX_MONTH_YEAR, MIN_MONTH_YEAR, monthParam } from "@/lib/dates";
import type { HistoryTab } from "@/lib/history-params";
import { cn } from "@/lib/utils";

interface Props {
  /** The month shown now, YYYY-MM-01. */
  month: string;
  /** Its name for the title, e.g. "Październik 2026". */
  label: string;
  /** The current month in Warsaw, YYYY-MM-01 (computed on the server, so the browser's time zone does not matter). */
  currentMonth: string;
  /** Kept when moving to another month, like the arrows do. */
  typ: HistoryTab;
  categoryId?: string;
}

const shortNames = new Intl.DateTimeFormat("pl-PL", { month: "short", timeZone: "UTC" });
const MONTH_NAMES = Array.from({ length: 12 }, (_, index) => {
  const name = shortNames.format(new Date(Date.UTC(2000, index, 1)));
  return name.charAt(0).toUpperCase() + name.slice(1);
});

const yearButtonClass = "min-h-11 min-w-11 text-purple-300 hover:bg-white/10 hover:text-purple-100";

/** The month title as a button; it opens a panel with a year and a grid of 12 months, one tap to jump anywhere. */
export default function MonthPicker({ month, label, currentMonth, typ, categoryId }: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const selectedYear = Number(month.slice(0, 4));
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selectedYear);

  function hrefFor(target: string): string {
    const query = new URLSearchParams({ typ, month: monthParam(target) });
    if (typ === "wydatki" && categoryId) query.set("kategoria", categoryId);
    return `/history?${query.toString()}`;
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          // Always open on the year being viewed, not on one browsed in an earlier visit.
          setYear(selectedYear);
          setOpen(true);
        }}
        className="flex min-h-11 items-center gap-1 rounded-lg px-2 hover:bg-white/10"
      >
        <span className="bg-gradient-to-r from-blue-200 to-purple-200 bg-clip-text text-2xl font-bold text-transparent">
          {label}
        </span>
        <ChevronDown aria-hidden="true" className="size-5 text-purple-300" />
      </button>

      <Drawer open={open} onOpenChange={setOpen} direction={isDesktop ? "right" : "bottom"}>
        <DrawerContent className="border-white/10 bg-slate-900 text-white data-[vaul-drawer-direction=bottom]:max-h-[70dvh] data-[vaul-drawer-direction=right]:sm:max-w-sm">
          <DrawerHeader className="flex-row items-center justify-between pb-2">
            <div className="text-left">
              <DrawerTitle className="text-lg text-white">Wybierz miesiąc</DrawerTitle>
              <DrawerDescription className="sr-only">Wybierz rok i miesiąc historii</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Zamknij"
                className="min-h-11 min-w-11 text-white hover:bg-white/10"
              >
                <X className="size-5" />
              </Button>
            </DrawerClose>
          </DrawerHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                aria-label="Poprzedni rok"
                disabled={year <= MIN_MONTH_YEAR}
                onClick={() => {
                  setYear(year - 1);
                }}
                className={yearButtonClass}
              >
                <ChevronLeft className="size-5" />
              </Button>
              <span className="text-lg font-semibold tabular-nums">{year}</span>
              <Button
                type="button"
                variant="ghost"
                aria-label="Następny rok"
                disabled={year >= MAX_MONTH_YEAR}
                onClick={() => {
                  setYear(year + 1);
                }}
                className={yearButtonClass}
              >
                <ChevronRight className="size-5" />
              </Button>
            </div>

            <div role="group" aria-label="Miesiąc" className="grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((name, index) => {
                const target = `${year}-${String(index + 1).padStart(2, "0")}-01`;
                const selected = target === month;
                return (
                  <a
                    key={target}
                    href={hrefFor(target)}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center justify-center rounded-lg border px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none",
                      selected
                        ? "border-purple-400 bg-purple-600 text-white"
                        : "border-white/20 bg-white/10 text-blue-100/90 hover:bg-white/20",
                      target === currentMonth && !selected && "border-purple-300/60",
                    )}
                  >
                    {name}
                  </a>
                );
              })}
            </div>

            {month !== currentMonth && (
              <a
                href={hrefFor(currentMonth)}
                className="flex min-h-11 items-center justify-center rounded-lg text-sm text-purple-300 transition-colors hover:bg-white/10 hover:text-purple-100"
              >
                Bieżący miesiąc
              </a>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
