// Build gallery/index.json from gallery/themes/*.json, checking every theme.
// `node scripts/build-gallery.mjs`          writes the index
// `node scripts/build-gallery.mjs --check`  only validates (used on pull requests)
// Studio downloads the index from the main branch to fill its Gallery tab.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { cleanGalleryTheme, contrast } from "../lib/shared.js";

const root = new URL("..", import.meta.url);
const dir = new URL("gallery/themes/", root);
const check = process.argv.includes("--check");

const problems = [];
const themes = [];
const ids = new Set();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
	let raw;
	try {
		raw = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
	} catch (e) {
		problems.push(`${file}: not valid JSON (${e.message})`);
		continue;
	}
	const theme = cleanGalleryTheme(raw);
	if (!theme) {
		problems.push(`${file}: needs an "id" plus "dark" and "light", each with "bg", "fg" and "accent" hex colours`);
		continue;
	}
	if (file !== theme.id + ".json") problems.push(`${file}: file name should be ${theme.id}.json`);
	if (ids.has(theme.id)) problems.push(`${file}: id "${theme.id}" is already taken`);
	ids.add(theme.id);
	for (const mode of ["dark", "light"]) {
		const m = theme[mode];
		const text = contrast(m.fg, m.bg);
		const accent = contrast(m.accent, m.bg);
		if (text < 7) problems.push(`${file}: ${mode} text contrast is ${text.toFixed(2)}:1; it needs 7:1`);
		if (accent < 3) problems.push(`${file}: ${mode} accent contrast is ${accent.toFixed(2)}:1; it needs 3:1`);
	}
	if (!theme.author) problems.push(`${file}: add an "author" so you get the credit`);
	themes.push(theme);
}

for (const p of problems) console.log("✗ " + p);
if (problems.length) {
	console.log(`\n${problems.length} problem(s) in the gallery`);
	process.exit(1);
}
if (!check) {
	themes.sort((a, b) => a.name.localeCompare(b.name));
	writeFileSync(new URL("gallery/index.json", root), JSON.stringify({ version: 1, themes }, null, "\t") + "\n");
}
console.log(`✓ ${themes.length} gallery theme(s) ${check ? "valid" : "written to gallery/index.json"}`);
