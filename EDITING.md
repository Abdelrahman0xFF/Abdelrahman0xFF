# Editing guide

Everything you can change lives in **`config.json`**. The SVGs in `assets/` are generated from it.

## Change text or colors
1. Open `config.json` (on github.com, click the pencil icon, or edit locally).
2. Change what you want:
   - **Colors:** `theme` block (`accent`, `accent2`, `accent3`, `warm`, `bg`, `panel`, ...). Each project card also has its own `color`.
   - **Banner:** `profile.name`, `profile.tagline`, `profile.typing` (the lines that get typed), `profile.orbit` (the orbiting badges).
   - **Terminal:** `terminal.blocks` (command + output pairs).
   - **Tech stack:** `stack.row1` / `stack.row2` (`name` + `color` per pill).
   - **Projects:** `projects` (title, label, desc, tags, color, icon: `coffee`, `progress`, `plane`, `pulse`).
   - **Section headings, buttons, quote:** `sections`, `contact`, `footer`.
3. Commit. The **Rebuild SVG assets** workflow regenerates `assets/` automatically.
   Or locally: `node generate.js` (no dependencies), then commit.

## Change links or the bullet list
Those live in `README.md` (plain HTML/Markdown). Contact button labels come from `config.json`, their URLs from `README.md`.

## Contribution snake (one-time setup)
Go to **Actions -> Generate contribution snake -> Run workflow** once. It creates the `output` branch the README points to.

## Add a new project card
Add an object to `projects` in `config.json`, then add a matching `<td>` in `README.md` pointing to `assets/card-<id>.svg`.
