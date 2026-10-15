import { cn } from "@/lib/utils";
import type { Category } from "@/types";

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryGrid({ categories, selectedId, onSelect }: Props) {
  return (
    <div role="group" aria-label="Kategoria" className="grid grid-cols-3 gap-2">
      {categories.map((category) => {
        const selected = category.id === selectedId;
        return (
          <button
            key={category.id}
            type="button"
            data-category-id={category.id}
            aria-pressed={selected}
            onClick={() => {
              onSelect(category.id);
            }}
            className={cn(
              "focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 rounded-lg border px-2 py-1 text-sm leading-tight transition-colors outline-none focus-visible:ring-3",
              selected
                ? "border-ring bg-primary text-primary-foreground"
                : "border-input bg-card text-muted-foreground hover:bg-input",
            )}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
