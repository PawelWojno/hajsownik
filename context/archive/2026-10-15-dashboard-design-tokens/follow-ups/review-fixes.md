# Follow-ups: dashboard-design-tokens

Pomysły i poprawki odłożone na osobne zmiany (z przeglądów i rozmowy w trakcie implementacji).

- **Menu zamyka się po kliknięciu obok** (`src/components/Topbar.astro`, menu hamburger i „Ustawienia” na `<details>`): dziś zamyka się tylko kliknięciem w nagłówek, bo tak działa natywny `<details>`. To nie regres tej zmiany. Wymaga kilku linii skryptu (zamknięcie po kliknięciu poza menu i po Esc). Źródło: pytanie użytkownika w fazie 3, impl-review całości F4.
