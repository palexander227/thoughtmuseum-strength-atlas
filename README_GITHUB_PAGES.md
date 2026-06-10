# ThoughtMuseum Strength Atlas — Beta Release 0.2

This folder is ready to publish on GitHub Pages.

## Files

- `index.html` — main single-page atlas
- `assets/styles.css` — visual styling
- `assets/app.js` — filters, lesson tray, modal, session builder
- `data/exercises.js` — exercise database
- `data/exercise_catalog.csv` — spreadsheet-friendly export

## GitHub Pages deployment

1. Create a repository, for example `thoughtmuseum-strength-atlas`.
2. Upload this folder's contents to the repository root.
3. In GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Save.
6. Wait for GitHub to publish the site.

## Local preview

Open `index.html` directly in your browser.

## Editing the exercise database

Edit `data/exercises.js`. Each entry has:

- `name`
- `group`
- `pattern`
- `equipment`
- `level`
- `tracks`
- `source`
- `purpose`
- `cues`
- `caution`

Keep exercise descriptions original and concise. Add images or video only when you own the content, have permission, or use appropriately licensed media.
