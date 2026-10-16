---
name: github-issue-sync
description: Close or create the GitHub issue matching a Change ID — create one right after /10x-plan (for a roadmap item or for a standalone change with no roadmap entry), close it after /10x-archive — and offer to move the issue on the GitHub Project board (Status column). Takes exactly one argument, a Change ID. Use when the user explicitly invokes /github-issue-sync <change-id>.
disable-model-invocation: true
---

Hand-authored, project-specific skill — not installed/managed by `10x-cli`. It lives outside that tool's tracked skill set on purpose, so it survives `10x sync` untouched. Do not let `/10x-*` lesson chains move or rewrite this file.

## What this is

A human-confirmed bridge between the project's change tracking and this repo's GitHub Issues. A Change ID comes from one of two **sources**, resolved in Step 0:

- **roadmap** — the ID is a roadmap item in `context/foundation/roadmap.md`, the source of truth for its Status.
- **change** — the ID has no roadmap item but has a change folder (`context/changes/<id>/` or `context/archive/<created>-<id>/`); Status comes from that folder's `change.md`. This covers standalone changes such as UI fixes or follow-ups.

One-way only: this skill reads the roadmap / change folder and writes to GitHub, never the reverse. It never touches a `Status` field — that stays the exclusive job of `/10x-plan`, `/10x-implement`, `/10x-archive`. The only things it writes back are bookkeeping fields recording which issue a Change ID maps to: `**GitHub:** #N` in `roadmap.md` (source roadmap) or `github_issue: N` in the frontmatter of `change.md` (source change, only while the folder is still under `context/changes/`). At the end it also offers (never silently) to move the issue's card on the GitHub Project board (Step 4).

## When to use, when to skip

**Use when**: the user runs `/github-issue-sync <change-id>` — typically right after `/10x-plan <change-id>` (to create the issue, so the card exists with the plan summary before implementation starts) and again right after `/10x-archive <change-id>` (to close it). Always invoked explicitly by the user — never call this skill on your own initiative after seeing a plan or an archive happen.

**Skip when**: no argument is given (ask for one, don't guess which change-id the user means) or `gh` isn't usable (see Step 1).

## Procedure

### Step 0 — Resolve the Change ID

`$ARGUMENTS` must be exactly one Change ID (kebab-case, e.g. `first-expense-and-income`). If empty, ask the user for it in plain text — do not guess from "most recently archived" or any other inference.

Resolve the **source** of the ID. Roadmap first:

```bash
grep -nE '\*\*Change ID:\*\* `?'"$CHANGE_ID"'`?[[:space:]]*$' context/foundation/roadmap.md 2>/dev/null
```

The backticks are optional on purpose: `roadmap.md` writes `- **Change ID:** <id>` without them, while issue bodies (Step 2/5) write it with them. A missing `roadmap.md` is not an error here — it just means "no roadmap item".

- **Found** → `SOURCE=roadmap`. Read the full item block (from its `### F-NN:`/`### S-NN:` heading to the next `###` or `##`) to capture: Roadmap ID, Outcome, PRD refs, Prerequisites, Status, and whether a `**GitHub:** #N` line already exists in the block.
- **Not found** → look for a change folder:

  ```bash
  CHANGE_DIR=$(ls -d "context/changes/$CHANGE_ID" context/archive/*-"$CHANGE_ID" 2>/dev/null | head -1)
  ```

  Folder with a `change.md` found → `SOURCE=change`. Read its frontmatter (`title`, `status`, `created`, and `github_issue` if present) and remember whether the folder is archived (`CHANGE_DIR` starts with `context/archive/`). If `plan-brief.md` / `plan.md` exist next to it, they feed the issue body in Step 5.
- **Neither** → stop and report: `✗ No roadmap item and no change folder for Change ID "<change-id>" (checked context/foundation/roadmap.md, context/changes/, context/archive/).` Do not proceed — there's nothing to base a title or body on without one of them.

For `SOURCE=roadmap` also resolve `CHANGE_DIR` the same way (it may be empty — an item that is not planned yet has no folder); Step 5 uses it for the plan summary.

Print one line saying which source was used, e.g. `ℹ Source: change (no roadmap item) — context/changes/<id>/`.

### Step 1 — Check `gh` availability

```bash
gh auth status
```

If `gh` is missing or not logged in: print `ℹ GitHub Issues pominięte: gh niedostępny lub niezalogowany.` and STOP. Do not block or warn about anything else — this skill is purely optional tooling.

Resolve the repo once, don't hardcode it:

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
```

### Step 2 — Find the existing issue, if any

**If a number is already stored** — `**GitHub:** #N` in the roadmap item block (source roadmap) or `github_issue: N` in `change.md` (source change):

```bash
gh issue view <N> --repo "$REPO" --json number,title,url,state
```

- `state: OPEN` → go to Step 3 (close mode) with this issue.
- `state: CLOSED` → report `ℹ Issue #<N> is already closed.` and go to Step 4 (the board card may still need moving).
- 404 / not found → the stored number is stale (issue deleted). Warn `⚠ Stored GitHub:#<N> no longer exists — treating as no issue.` and fall through to the search below.

**If nothing is stored (or the stored number was stale):**

```bash
gh issue list --repo "$REPO" --state all --search "\"$CHANGE_ID\"" --json number,title,url,body,state
```

**Must be `--state all`, not `--state open`.** This fallback is the only thing standing between "roadmap.md got regenerated and lost its `GitHub:` bookkeeping" and "we silently create a duplicate issue for something already closed." If this searched open-only, a closed/done item whose field got wiped would look like it has no issue at all — go to Create mode — because a `--state open` search can never find a closed one and come back empty. That's worse than merely losing the cache; it would actively create a duplicate instead of just re-discovering the real one. `--state all` means the one true anchor (the `change_id` baked into the issue body at creation time, which nothing ever regenerates) is always reachable, regardless of what roadmap.md currently remembers.

This is a broad text search — do not trust it directly. Filter the results client-side for an exact match of the literal pattern `` **Change ID:** `<change-id>` `` inside each candidate's `body`. This avoids false positives from loose full-text search matching an unrelated issue that happens to mention the string.

- **Zero** exact matches → go to Step 5 (create mode).
- **Exactly one** exact match → this is the issue, regardless of its `state`. Backfill the number now so future runs skip the search — see "Where the number is written back" below. Then branch on `state`: `OPEN` → go to Step 3 (close mode) with this issue; `CLOSED` → report `ℹ Issue #<N> is already closed.` and go to Step 4 (do not reopen it, do not offer to create a new one).
- **More than one** exact match → print all matches (number, title, url, state) and STOP. Do not guess which one is authoritative — report `✗ Multiple issues match Change ID "<change-id>" — resolve manually.`

#### Where the number is written back

Used by the backfill above and by Step 5 after creating an issue. One `Edit`, never more:

- **Source roadmap** → add `**GitHub:** #<N>` to the item's block in `roadmap.md`, immediately after that item's `**Status:**` line.
- **Source change, folder under `context/changes/`** → add `github_issue: <N>` to the `change.md` frontmatter, on the line after `status:`. Other 10x skills read only the keys they know, so an extra key is safe.
- **Source change, folder under `context/archive/`** → **do not write.** Archived folders are read-only by convention (every 10x skill refuses to write there). Skip the backfill; the body-anchor search above finds the issue again on the next run, and the reference stays correct because the number is already in the issue itself.

### Step 3 — Close mode: ask before closing

```
AskUserQuestion:
  question: "Issue #<N> (\"<title>\") jest otwarty dla \"<change-id>\" (<roadmap|change> status: <status>). Zamknąć?"
  header: "GitHub"
  options:
    - label: "Zamknij issue (Recommended)"
      description: "gh issue close. Źródłem prawdy jest roadmap.md / change.md; to tylko kopia na GitHubie."
    - label: "Zostaw otwarte"
      description: "Issue zostaje OPEN. Nic się nie zmienia."
```

Note the `Status` (roadmap item, or `change.md` for source change) in the question itself (don't hard-gate on `done` / `archived` — just show it, so the user decides with full information; closing earlier is a valid call if they ask for it).

**On "Zamknij issue":**

```bash
ARCHIVE_DIR=$(ls context/archive/ 2>/dev/null | grep -- "$CHANGE_ID" | head -1)
```

- If found: `gh issue close <N> --repo "$REPO" --comment "Archived via /10x-archive → context/archive/${ARCHIVE_DIR}/."` — for source roadmap append ` See roadmap.md ## Done.`
- If not found (closing without an archive having happened): `gh issue close <N> --repo "$REPO" --comment "Closed via github-issue-sync."` — for source roadmap append ` See context/foundation/roadmap.md.`

Print the issue URL, then go to Step 4 with this issue (now closed).

**On "Zostaw otwarte":** do not touch the issue. Report that it stays open, then go to Step 4 with this issue (still open) — moving the card to "In Progress" without closing is a normal use.

### Step 5 — Create mode: ask before creating

**Plan summary (both sources).** If `plan-brief.md` exists next to the roadmap item's change folder or in `CHANGE_DIR`, build a short plan section for the body — a pointer, not a copy of the plan:

- **Summary**: the first paragraph under `## What & Why` in `plan-brief.md`.
- **Phases**: the titles of the `### Phase N:` / `### Faza N:` headings in the `## Progress` section of `plan.md`, as a numbered list.
- No plan files yet → omit this section and end the body with `Plan this with /10x-plan <change-id>.` instead (issue created before planning).

Do not link to plan files: the folder moves from `context/changes/` to `context/archive/<created>-<id>/` on archive, so a link would rot. Name the folder in backticks instead (see the body templates).

#### Source roadmap

Gather everything needed from `roadmap.md`:

- **Title**: the matching row's "Suggested issue title" column in `## Backlog Handoff`. If that table has no row for this Change ID (shouldn't happen for a valid roadmap, but don't crash), fall back to the item's `Outcome` line.
- **Label**: `foundation` if the Roadmap ID starts with `F-`, else `slice`.
- **Milestone**: `gh api repos/$REPO/milestones --jq '.[] | select(.state=="open") | .title'` — use the (single) open milestone if one exists; if none or ambiguous, skip milestone assignment and say so.
- **Depends on**: for each Prerequisite listed on the item (other Roadmap IDs), look up *their* `**GitHub:** #N` field in `roadmap.md`. If a prerequisite has no issue yet, name it by Change ID in plain text instead of a `#N` link — do not create issues for prerequisites as a side effect of this step.

Body format (mirrors the issues already created in this repo — keep it a pointer, not a duplicate of the full roadmap body):

```markdown
**Roadmap ID:** <F-NN or S-NN> · **Change ID:** `<change-id>`

**Outcome:** <copied from roadmap.md>

**PRD refs:** <copied>
**Depends on:** <resolved #N links or plain Change IDs, or "none">
**Status:** <current roadmap Status>

Full detail: [`context/foundation/roadmap.md` § <Roadmap ID>](https://github.com/<REPO>/blob/master/context/foundation/roadmap.md#<anchor>)

<plan summary section from above, if plan files exist; otherwise: Plan this with `/10x-plan <change-id>`.>
```

#### Source change (no roadmap item)

- **Title**: `title` from `change.md`.
- **Label**: no roadmap Roadmap ID to derive one from, so offer one of the repo's existing labels in the confirmation question below: `enhancement` (default), `bug`, `documentation`. Never invent a label; if the chosen one does not exist (`gh label list`), create the issue without a label and say so.
- **Milestone**: none. The open milestone describes a roadmap scope; a standalone change does not belong to it unless the user says so. Say `ℹ Milestone pominięty (zmiana spoza roadmapy).`
- **Depends on**: none.

Body format — the first line must contain `**Change ID:** `<change-id>`` exactly, because Step 2's search matches on it:

```markdown
**Change ID:** `<change-id>` · **Source:** standalone change (no roadmap item)

**Summary:** <plan-brief.md "What & Why" first paragraph; if there is no plan-brief, the first line under `## Notes` in change.md; if neither, the title>

**Phases:**
1. <phase 1 title>
2. <phase 2 title>

**Status:** <change.md status>

Folder: `context/changes/<change-id>/` (after `/10x-archive`: `context/archive/<created>-<change-id>/`)
```

Omit **Phases** when there is no `plan.md`.

Ask before creating (print title, label, milestone and the body first, so the user sees what will be created):

```
AskUserQuestion:
  question: "Nie znaleziono GitHub issue dla \"<change-id>\". Stworzyć nowy?"
  header: "GitHub"
  options:
    - label: "Stwórz issue (Recommended)"
      description: "gh issue create z tytułem/treścią z roadmap.md lub change.md, etykietą <foundation|slice|enhancement>, i milestone (tylko dla pozycji roadmapy)."
    - label: "Stwórz jako bug"            # source change only; omit for source roadmap
      description: "To samo, ale z etykietą bug zamiast enhancement."
    - label: "Nie, pomiń"
      description: "Nic nie twórz."
```

**On "Stwórz issue" / "Stwórz jako bug":**

```bash
gh issue create --repo "$REPO" --title "<title>" --label "<label>" --milestone "<milestone title, if resolved>" --body "<body>"
```

Omit `--label` / `--milestone` when none applies. Capture the returned URL, extract the issue number, and **write the number back** as described under "Where the number is written back" (Step 2). Print the URL, then go to Step 4 with the new issue.

**On "Nie, pomiń":** do nothing. Report that no issue was created.

### Step 4 — Project board status: ask before moving the card

Runs last, from Steps 2, 3 and 5, for the one issue this invocation dealt with. It only ever *offers* a change; nothing on the board moves without the `AskUserQuestion` below. Nothing is hardcoded — project, field and option ids are resolved at run time, because they differ per repo and change when a project is recreated.

**4a. Find the project.**

```bash
OWNER=${REPO%%/*}
gh project list --owner "$OWNER" --format json --jq '.projects[] | {number, title, id}'
```

- Command fails mentioning a missing `project` scope → print `ℹ Tablica pominięta: gh nie ma uprawnienia "project" (uruchom: gh auth refresh -s project).` and STOP. Do not run the refresh yourself (it is interactive).
- Zero projects → print `ℹ Brak tablicy projektu dla ${OWNER} — pomijam.` and STOP.
- Exactly one → use it. More than one → `AskUserQuestion` "Która tablica?" with one option per project (title), and use the answer.

**4b. Find the issue's card and the Status field.**

```bash
gh project item-list <number> --owner "$OWNER" --limit 200 --format json
gh project field-list <number> --owner "$OWNER" --format json
```

- Card = the item whose `content.number` is the issue number and whose `content.repository` is `$REPO`. Keep its `id` and current `status`.
- Field = the single-select field named `Status`; keep its `id` and its `options` (`id`, `name`). No such field → print `ℹ Tablica nie ma pola Status — pomijam.` and STOP.
- Card not found → ask `AskUserQuestion` "Issue #<N> nie jest na tablicy \"<title>\". Dodać?" with options `Dodaj na tablicę (Recommended)` / `Nie, pomiń`. On add: `gh project item-add <number> --owner "$OWNER" --url <issue url>`, take the returned item id, and treat its current status as empty. On skip: STOP.

**4c. Pick the recommended status.** Map by what just happened and the `Status` from Step 0 (roadmap item, or `change.md` for source change), then match to the closest real option name (case-insensitive; never invent an option):

| Situation | Recommended option |
| --- | --- |
| Issue is closed, or status is `done` / `archived` / `implemented` / `impl_reviewed` | the "done" option (e.g. `Done`) |
| Status is `in-progress`, `planning` or `implementing` | the "in progress" option (e.g. `In Progress`) |
| anything else (`proposed`, `ready`, `planned`, `plan_reviewed`, new issue) | the first / "todo" option (e.g. `Todo`) |

If the card's current status already equals the recommended option, print `ℹ Tablica: #<N> już ma status "<status>".` and STOP — nothing to offer.

**4d. Ask.**

```
AskUserQuestion:
  question: "Tablica \"<project title>\": issue #<N> (\"<title>\") ma status \"<current or brak>\". Zmienić status?"
  header: "Tablica"
  options:
    - label: "Ustaw \"<recommended>\" (Recommended)"
      description: "gh project item-edit na polu Status. Roadmap.md nie jest ruszany."
    - label: "Ustaw \"<other option>\""        # one entry per remaining Status option except the current one and the recommended one (at most 2)
      description: "Inny status z tablicy."
    - label: "Zostaw bez zmian"
      description: "Karta zostaje w obecnej kolumnie."
```

**On a status choice:**

```bash
gh project item-edit --id <item id> --project-id <project id> --field-id <status field id> --single-select-option-id <option id>
```

Re-read the card (`gh project item-list ... --format json`, same filter) and print `✓ Tablica: #<N> → <status>` with the project URL; if the re-read does not show the new status, print `⚠ Zmiana nie została zapisana — sprawdź tablicę ręcznie.` Never retry in a loop.

**On "Zostaw bez zmian":** do nothing further.

## What this skill does NOT do

- Never closes or creates an issue without the corresponding `AskUserQuestion` confirmation above — no silent action in either direction.
- Never writes to `roadmap.md`'s `Status` field or to `change.md`'s `status`. The only things it ever adds are `**GitHub:** #N` (roadmap) and `github_issue: N` (`change.md`, live folders only).
- Never writes anything under `context/archive/` — an archived change folder is read-only, so no backfill happens there (see "Where the number is written back").
- Never guesses when more than one open issue matches a Change ID — lists them and stops.
- Never assigns the open milestone to a standalone change (source change) on its own; milestones are for roadmap items.
- Never runs any part of its logic if `gh` is unavailable or unauthenticated (Step 1) — fails soft, never blocks `/10x-archive` or any other workflow.
- Never moves a card on the Project board, and never adds an issue to a board, without the matching `AskUserQuestion` in Step 4. It does not create, rename or reconfigure projects or their fields, and it does not rely on a hardcoded project number or ids. The Project's own "Item closed → Status: Done" automation, if enabled, still works independently of this skill.
- Does not run automatically after `/10x-plan`, `/10x-archive` or any other skill — always a separate, explicit invocation. It deliberately is not wired into `/10x-plan`: that skill is managed by `10x-cli` and a `10x sync` would overwrite the hook, whereas this file survives sync.
