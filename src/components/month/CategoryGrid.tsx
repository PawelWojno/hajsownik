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
              "min-h-11 rounded-lg border px-2 py-1 text-sm leading-tight transition-colors focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none",
              selected
                ? "border-purple-400 bg-purple-600 text-white"
                : "border-white/20 bg-white/10 text-blue-100/90 hover:bg-white/20",
            )}
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
