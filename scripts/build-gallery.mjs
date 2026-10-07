// Build gallery/index.json from gallery/themes/*.json and gallery/prompts/*.json, checking each entry.
// `node scripts/build-gallery.mjs`          writes the index
// `node scripts/build-gallery.mjs --check`  only validates (used on pull requests)
// Studio downloads the index from the main branch to fill its Gallery tab.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cleanGalleryTheme, cleanGalleryPack, contrast } from "../lib/shared.js";

const root = new URL("..", import.meta.url);
const check = process.argv.includes("--check");
const problems = [];

/** Every JSON file in a gallery folder, parsed and cleaned. */
function entries(folder, clean, describe) {
	const dir = new URL(`gallery/${folder}/`, root);
	if (!existsSync(dir)) return [];
	const out = [];
	const ids = new Set();
	for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
		const where = `${folder}/${file}`;
		let raw;
		try {
			raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
		} catch (e) {
			problems.push(`${where}: not valid JSON (${e.message})`);
			continue;
		}
		const entry = clean(raw);
		if (!entry) {
			problems.push(`${where}: ${describe}`);
			continue;
		}
		if (file !== entry.id + ".json") problems.push(`${where}: file name should be ${entry.id}.json`);
		if (ids.has(entry.id)) problems.push(`${where}: id "${entry.id}" is already taken`);
		ids.add(entry.id);
		if (!entry.author) problems.push(`${where}: add an "author" so you get the credit`);
		out.push({ entry, where, raw });
	}
	return out;
}

const themes = entries("themes", cleanGalleryTheme, `needs an "id" plus "dark" and "light", each with "bg", "fg" and "accent" hex colours`);
for (const { entry: theme, where } of themes) {
	for (const mode of ["dark", "light"]) {
		const m = theme[mode];
		const text = contrast(m.fg, m.bg);
		const accent = contrast(m.accent, m.bg);
		if (text < 7) problems.push(`${where}: ${mode} text contrast is ${text.toFixed(2)}:1; it needs 7:1`);
		if (accent < 3) problems.push(`${where}: ${mode} accent contrast is ${accent.toFixed(2)}:1; it needs 3:1`);
	}
}

const packs = entries("prompts", cleanGalleryPack, `needs an "id", a "name" and a "prompts" list of { "title", "text" }`);
for (const { entry: pack, where, raw } of packs) {
	if (raw.prompts.length > pack.prompts.length) problems.push(`${where}: ${raw.prompts.length - pack.prompts.length} prompt(s) have no text or go past the 50-prompt limit`);
	if (/<script|javascript:/i.test(JSON.stringify(pack))) problems.push(`${where}: prompts can't contain scripts`);
}

for (const p of problems) console.log("✗ " + p);
if (problems.length) {
	console.log(`\n${problems.length} problem(s) in the gallery`);
	process.exit(1);
}
if (!check) {
	const byName = (a, b) => a.name.localeCompare(b.name);
	const index = { version: 2, themes: themes.map((x) => x.entry).sort(byName), packs: packs.map((x) => x.entry).sort(byName) };
	writeFileSync(new URL("gallery/index.json", root), JSON.stringify(index, null, "\t") + "\n");
}
console.log(`✓ ${themes.length} theme(s) and ${packs.length} prompt pack(s) ${check ? "valid" : "written to gallery/index.json"}`);
