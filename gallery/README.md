# Studio theme gallery

Every theme in this folder shows up in the **Gallery** tab of Studio for everyone, one click to add.

## Submit a theme

The easy way, from inside Studio:

1. Open **Studio → Theme editor** and make your theme (or start from an image with **Theme from an image**).
2. Press **🌍 Submit to the gallery**.
3. GitHub opens with your theme file already filled in. Add a line about it and press **Propose changes**, then **Create pull request**.

That's it. A check runs on your pull request to make sure the theme is readable. Once it's merged, the gallery updates for everyone within the hour.

## By hand

Add one file to `gallery/themes/`, named after the theme's `id`:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "emoji": "🎨",
  "author": "your name or GitHub handle",
  "description": "One short line about it.",
  "dark":  { "bg": "#101418", "fg": "#e8eef4", "accent": "#5ab0ff" },
  "light": { "bg": "#f6f8fa", "fg": "#14181c", "accent": "#0b6bcb" }
}
```

- `id`: lowercase letters, numbers and dashes. The file is `<id>.json`.
- `dark` and `light`: three colours each. Studio derives every surface, border and text shade from them.
- Text needs at least **7:1** contrast against the background, and the accent at least **3:1**. The editor shows both ratios as you pick colours.

Check it locally with `node scripts/build-gallery.mjs --check`.

## Rules

- Your own work, or a palette whose licence allows it (credit the original in `description`).
- No logos, trademarks or offensive names.
- Themes are published under the repository's MIT licence.
