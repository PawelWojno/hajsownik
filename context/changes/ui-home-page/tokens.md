# Tokens: ui-home-page

Źródło wartości: hexy ze szkicu karuzeli (slajdy 2 i 3). Definicje w `src/styles/global.css` (`:root` = jasny, `.dark` = ciemny; aplikacja na stałe ma `.dark` na `<html>`). Wartości jasne są dobrane jako ciemniejsze odcienie czytelne na jasnym tle, ale nie są jeszcze zweryfikowane wizualnie.

| Token                | Jasny (`:root`)          | Ciemny (`.dark`)           | Zastępuje              |
| -------------------- | ------------------------ | -------------------------- | ---------------------- |
| `--category-housing` | `oklch(0.511 0.23 275)`  | `oklch(0.681 0.169 275)`   | `#7c8cff` (Mieszkanie) |
| `--category-food`    | `oklch(0.541 0.25 293)`  | `oklch(0.709 0.159 293.5)` | `#a78bfa` (Żywność)    |
| `--category-car`     | `oklch(0.588 0.158 242)` | `oklch(0.754 0.139 232.7)` | `#38bdf8` (Samochód)   |
| `--category-kids`    | `oklch(0.6 0.16 60)`     | `oklch(0.769 0.165 70.1)`  | `#f59e0b` (Dzieci)     |
| `--category-fun`     | `oklch(0.592 0.22 350)`  | `oklch(0.725 0.175 349.8)` | `#f472b6` (Rozrywka)   |
| `--category-other`   | `oklch(0.554 0.046 257)` | `oklch(0.711 0.035 256.8)` | `#94a3b8` (Inne)       |

Przychody i „Zostaje" używają istniejącego `--success` (bez nowego tokenu).

Inne zmiany: wszystkie nowe tokeny są opublikowane w `@theme inline` jako `--color-category-*`. Istniejące tokeny bez zmian.
