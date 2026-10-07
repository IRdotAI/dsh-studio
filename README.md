# Studio for DeepSeek Harness

Themes and personalisation for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): 17 themes and a theme editor, liquid-glass panels, wallpapers, fonts, your own app name / logo / greeting, saved prompts, a Ctrl+K quick switcher, and optional custom instructions for the AI.

Zero npm dependencies. Everything stays on your machine.

![Studio with the Liquid Glass theme and frosted-glass panels](docs/screenshots/themes-dark.jpg)

| Liquid glass + personal greeting | Quick switcher (live preview) | Theme editor |
| --- | --- | --- |
| ![Frosted-glass composer over a wallpaper, greeting "Good night, RdotA"](docs/screenshots/greeting.jpg) | ![Ctrl+K quick switcher previewing Tokyo Night](docs/screenshots/quick-switcher.jpg) | ![Theme editor](docs/screenshots/theme-editor.jpg) |

| Saved prompts | Light mode (Synthwave) | Credits |
| --- | --- | --- |
| ![Saved prompts menu beside the composer](docs/screenshots/saved-prompts.jpg) | ![Studio themes page in light mode](docs/screenshots/themes-light.jpg) | ![Credits page](docs/screenshots/credits.jpg) |

## Install

**From the app:** open DSH → sidebar **Plugins** → **Add plugin** → enter

```
github:IRdotAI/dsh-studio
```

**From a terminal:**

```
npx @deepseek-ai/dsh plugin --profile web add github:IRdotAI/dsh-studio
```

Then restart `dsh web`. A **Studio** entry appears in the sidebar. Requires DSH 0.2 (tested with 0.2.0-rc.2), the web profile, and Node 22.5+. `pnpm` must be on your PATH for plugin installs (`npm install -g pnpm`).

To update, run the same `add` command again. To remove it, use **Uninstall** on its Plugins page entry.

## Using it

- **Studio** in the sidebar has everything, in tabs.
- **Ctrl+K** (Cmd+K on macOS) opens the quick switcher anywhere: themes (arrow through them to preview live; Esc puts yours back), light/dark, text size, ambience, saved prompts, Studio pages.
- In the composer, type **/theme**, **/prompts** or **/studio**, or click the **✦** button beside the input for saved prompts.

## Features

| Area | What you get |
| --- | --- |
| **17 themes** | Liquid Glass, Midnight, Dracula, Nord, Tokyo Night, Catppuccin, Rosé Pine, Gruvbox, Solarized, Forest, Ocean, Synthwave, Sakura, Arc Reactor, Espresso, Paper and AMOLED, plus the stock look. Each has a light and a dark version, so DSH's Light / Dark / System switch keeps working. |
| **Theme editor** | Pick a background, text and accent colour per mode. Studio derives every surface, border, button and text shade from them in OKLCH, with contrast floors so secondary text stays readable. Live contrast badges, whole-app preview while editing, 🎲 randomise, and shareable `dshs1:` theme codes. |
| **Liquid glass** | Style → Material turns the sidebar, composer, cards, dialogs, message bubbles and menus into frosted, see-through panes: backdrop blur, a faint frost, a specular top edge and a diagonal sheen. DSH's own surfaces are found at runtime, so it keeps working across DSH updates. **Match my desktop** applies the whole look in one click. |
| **Wallpaper** | Upload an image, use a URL, or (on Windows) **use your desktop wallpaper**, which follows wallpaper changes. Adjustable visibility and blur. |
| **Style** | Interface and code fonts (presets, any installed font, or a folder of `.otf/.ttf/.woff2` files), corner style, accent-tinted chat bubbles, accent text selection, surface tint. |
| **Ambience** | Aurora glow, vignette, film grain or CRT scanlines, with a strength slider. Never blocks clicks; honours reduced motion. |
| **Identity** | Rename the app in the sidebar, swap the logo (emoji, monogram or your own image, removable with one click), and replace the new-chat headline with a greeting like `Good {timeOfDay}, {name}`. |
| **AI preferences** | Optional custom instructions: your name, about you, a response style (Concise, Thorough, Friendly, Mentor, Butler, Hype), reply language and free-form instructions. **Off by default**; the tab shows exactly what the model will receive. |
| **Saved prompts** | Six starters; add, edit and reorder your own. They're inserted at your cursor. |
| **Advanced** | Custom CSS (applied last; use the `--dsw-*` design tokens), export/import settings as JSON, reset. |
| **Credits** | Who made Studio, what it builds on, and where each adapted theme palette comes from. |

## Privacy

- Settings live in `~/.dsh/studio/studio.json` (or `$DSH_HOME/studio/studio.json`), uploaded images included. Nothing is sent anywhere.
- AI preferences are only added to the model's system prompt while you have them switched on.
- A wallpaper set by **URL** is fetched by your browser from that URL. Uploads and the desktop wallpaper never leave your machine.

## How it works

DSH plugins have a host half (Node) and a browser half (React). Studio's host half stores settings, serves them over authenticated `/api/studio/*` routes, injects the stylesheet into every page load (so your theme is there from the very first frame), serves the desktop wallpaper and font files, and contributes the optional system-prompt section. The browser half renders the UI and updates the stylesheet live.

Theming works by re-deriving DSH's three static colour scales (`--dsw-static-neutral-bluish-*`, `--dsw-static-neutral-*`, `--dsw-static-deepseek-*`). Every alias token points at them, so the whole interface follows while keeping the original contrast ladder.

| File | Role |
| --- | --- |
| `lib/shared.js` | Pure core: colour maths, presets, palette generation, stylesheet builder, settings validation, persona text. Shared by both halves. |
| `lib/index.js` | Host half: settings file, API routes, first-paint stylesheet, desktop wallpaper and font serving, system-prompt section. |
| `src/client.js` | Browser half source: Studio page, quick switcher, composer button, slash commands, brand slots, glass-surface discovery. |
| `lib/client.js` | **Generated** browser bundle. Edit `src/client.js` or `lib/shared.js`, then run `node scripts/build.mjs`. |

### API

All routes are behind DSH's own browser authentication.

- `GET /api/studio/state`: settings plus what this machine offers (desktop wallpaper, served fonts)
- `POST /api/studio/patch`: partial update (objects merge, arrays replace)
- `POST /api/studio/replace`: whole-settings import
- `POST /api/studio/reset` with `{"confirm":"reset-studio"}`
- `GET /api/studio/desktop-wallpaper`: the current Windows wallpaper
- `GET /api/studio/font?f=<file>`: a file from the configured font folder (only files in that folder are served)

## Development

```
git clone https://github.com/IRdotAI/dsh-studio
cd dsh-studio
node scripts/build.mjs     # rebuild lib/client.js
node test/selftest.mjs     # 17 checks
npx @deepseek-ai/dsh plugin --profile web add "$PWD"   # install your local copy
```

Restart `dsh web` after changing `lib/index.js` (host modules are cached).

**DSH plugin pitfalls worth knowing:**

- `connection.fetch.register` paths must be the full path starting with `/api/`; anything else throws "invalid exact Fetch route".
- Exact routes are keyed by path alone, so GET and POST on one path must be one route with `methods: ["GET", "POST"]`.
- A `requestBody: "streaming"` route cannot serve GET (the bridge always attaches a body). Keep reads `buffered`.
- A host-injected `<style>` using `html:root body` selectors outranks DSH's token sheets and also covers the first paint.

## Credits

Made by **RdotA**. Theme palettes adapted from Dracula, Nord, Catppuccin, Gruvbox, Solarized, Tokyo Night and Rosé Pine. Full credits, with links, are in [CREDITS.md](CREDITS.md) and in the app under **Studio → Credits**.

## Licence

[MIT](LICENSE)
