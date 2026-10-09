import { useState } from "react";
import type { SubmitEvent } from "react";
import { ArchiveRestore, ArrowDown, ArrowUp, Check, Pencil, Trash2, X } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import { ADD_TARGET, useCategoryActions } from "@/hooks/useCategoryActions";
import { cn } from "@/lib/utils";
import type { ManagedCategory } from "@/types";

const fieldClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:ring-2 focus:ring-purple-400 focus:outline-none";
const actionClass = "min-h-11 min-w-11 text-purple-300 hover:bg-white/10 hover:text-purple-100";

interface Props {
  initialCategories: ManagedCategory[];
}

interface DeleteControlProps {
  pending: boolean;
  onConfirm: () => Promise<boolean>;
  /** Called when the user backs out, so an error from a failed attempt does not linger. */
  onCancel: () => void;
}

/** "Usuń" asks for a second click in place (no browser dialog, which a user can block). A failed delete keeps asking. */
function DeleteControl({ pending, onConfirm, onCancel }: DeleteControlProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setConfirming(true);
        }}
        className="min-h-11 text-red-300 hover:bg-white/10 hover:text-red-200"
      >
        <Trash2 className="size-4" />
        Usuń
      </Button>
    );
  }

  return (
    <div role="group" aria-label="Potwierdź usunięcie" className="flex items-center gap-1">
      <span className="text-sm text-red-200">Na pewno? Nie można cofnąć.</span>
      <Button
        type="button"
        disabled={pending}
        onClick={() => void onConfirm()}
        className="min-h-11 bg-red-600 text-white hover:bg-red-500"
      >
        Tak, usuń
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

export default function CategoryManager({ initialCategories }: Props) {
  const { categories, pending, error, clearError, add, rename, setArchived, remove, move } =
    useCategoryActions(initialCategories);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);

  async function handleAdd(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (await add(newName)) setNewName("");
  }

  async function handleRename(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !editing) return;
    if (await rename(editing.id, editing.name)) setEditing(null);
  }

  function renderName(category: ManagedCategory) {
    if (editing?.id !== category.id) {
      return (
        <span className={cn("min-w-0 flex-1 break-words", category.archived && "text-white/60")}>{category.name}</span>
      );
    }
    return (
      <form onSubmit={handleRename} className="flex min-w-0 flex-1 items-center gap-1">
        <input
          autoFocus
          aria-label={`Nowa nazwa kategorii ${category.name}`}
          maxLength={50}
          value={editing.name}
          onChange={(event) => {
            setEditing({ id: category.id, name: event.target.value });
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
          aria-label="Zapisz nazwę"
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
        Kategorie
      </h1>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <label htmlFor="new-category" className="text-sm text-blue-100/80">
          Nowa kategoria
        </label>
        <div className="flex gap-2">
          <input
            id="new-category"
            maxLength={50}
            autoComplete="off"
            placeholder="np. Zwierzęta"
            value={newName}
            onChange={(event) => {
              setNewName(event.target.value);
            }}
            className={cn(fieldClass, "min-h-11")}
          />
          <Button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded-lg bg-purple-600 px-4 font-medium text-white hover:bg-purple-500"
          >
            Dodaj
          </Button>
        </div>
        <ServerError message={error?.target === ADD_TARGET ? error.message : null} />
      </form>

      <section aria-labelledby="active-heading" className="flex flex-col gap-2">
        <h2 id="active-heading" className="text-lg font-semibold">
          Aktywne
        </h2>
        <p className="text-sm text-blue-100/70">Zmiana nazwy dotyczy też dawnych wydatków z tej kategorii.</p>
        {active.length === 0 && <p className="text-sm text-white/60">Brak aktywnych kategorii.</p>}
        <ul className="flex flex-col gap-2">
          {active.map((category, index) => (
            <li key={category.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
              <div className="flex flex-wrap items-center gap-1">
                {renderName(category)}
                {editing?.id !== category.id && (
                  <div className="flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Przesuń w górę: ${category.name}`}
                      disabled={pending || index === 0}
                      onClick={() => void move(category.id, -1)}
                      className={actionClass}
                    >
                      <ArrowUp className="size-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Przesuń w dół: ${category.name}`}
                      disabled={pending || index === active.length - 1}
                      onClick={() => void move(category.id, 1)}
                      className={actionClass}
                    >
                      <ArrowDown className="size-5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Zmień nazwę: ${category.name}`}
                      disabled={pending}
                      onClick={() => {
                        setEditing({ id: category.id, name: category.name });
                      }}
                      className={actionClass}
                    >
                      <Pencil className="size-5" />
                    </Button>
                  </div>
                )}
              </div>
              {editing?.id !== category.id && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => void setArchived(category.id, true)}
                    className="min-h-11 text-purple-300 hover:bg-white/10 hover:text-purple-100"
                  >
                    Archiwizuj
                  </Button>
                  <DeleteControl pending={pending} onConfirm={() => remove(category.id)} onCancel={clearError} />
                </div>
              )}
              <ServerError message={error?.target === category.id ? error.message : null} />
            </li>
          ))}
        </ul>
      </section>

      {archived.length > 0 && (
        <section aria-labelledby="archived-heading" className="flex flex-col gap-2">
          <h2 id="archived-heading" className="text-lg font-semibold">
            Zarchiwizowane
          </h2>
          <p className="text-sm text-blue-100/70">Nie pokazują się przy dodawaniu wydatku. Dawne wydatki zostają.</p>
          <ul className="flex flex-col gap-2">
            {archived.map((category) => (
              <li key={category.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="min-w-0 flex-1 break-words text-white/60">{category.name}</span>
                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/60">
                    zarchiwizowana
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => void setArchived(category.id, false)}
                    className="min-h-11 text-purple-300 hover:bg-white/10 hover:text-purple-100"
                  >
                    <ArchiveRestore className="size-4" />
                    Przywróć
                  </Button>
                  <DeleteControl pending={pending} onConfirm={() => remove(category.id)} onCancel={clearError} />
                </div>
                <ServerError message={error?.target === category.id ? error.message : null} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
