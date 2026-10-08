# Studio gallery

Every theme and prompt pack in this folder shows up in the **Gallery** tab of Studio for everyone, one click to add.

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
- `dark` and `light`: three colours each. Studio derives every surface, border and text shade from them. An optional fourth, `accent2`, sets the second colour used in gradients (otherwise Studio picks one next to the accent).
- **Download file** in the theme editor saves your theme in exactly this format.
- Text needs at least **7:1** contrast against the background, and the accent at least **3:1**. The editor shows both ratios as you pick colours.

Check it locally with `node scripts/build-gallery.mjs --check`.

## Submit a prompt pack

A prompt pack is a set of saved prompts, filed into folders, that anyone can add to their own list.

From inside Studio:

1. Open **Studio → Prompts** and put the prompts you want to share in a folder (or share them all).
2. Pick the folder next to **🌍 Submit to the gallery** and press it.
3. GitHub opens with the pack file filled in. Give it a name and a line about it, then **Propose changes** and **Create pull request**. (A very big pack is copied to your clipboard instead; paste it into the file.)

By hand, add one file to `gallery/prompts/`, named after the pack's `id`:

```json
{
  "id": "my-pack",
  "name": "My pack",
  "emoji": "✦",
  "author": "your name or GitHub handle",
  "description": "One short line about it.",
  "prompts": [
    { "title": "Summarise", "text": "Summarise this in five bullet points:

{clipboard}", "folder": "Reading" },
    { "title": "Explain", "text": "Explain {ask:Topic} to me like I'm new to it.", "folder": "Learning" }
  ]
}
```

- 1 to 50 prompts. `folder` is optional; prompts land in that folder when someone adds the pack.
- Placeholders work as they do in Studio: `{clipboard}`, `{date}`, `{time}`, `{day}` and `{ask:Question}`.

`node scripts/build-gallery.mjs --check` validates both themes and packs.

## Rules

- Your own work, or a palette or prompt whose licence allows it (credit the original in `description`).
- No logos, trademarks or offensive names, and no prompts meant to cause harm.
- Everything in the gallery is published under the repository's MIT licence.
