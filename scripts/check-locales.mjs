// Check the translations: every key the client uses exists in English, and
// every other language has exactly English's keys with the same {placeholders}.
// `node scripts/check-locales.mjs` prints problems and exits 1 if there are any.
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import * as shared from "../lib/shared.js";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const KEY = /^[a-z]+[A-Za-z]*(\.[A-Za-z0-9-]+)+$/;
const NAMESPACES = new Set(Object.keys(JSON.parse(read("locales/en.json"))).map((k) => k.split(".")[0]));

/** Keys the client code asks for, static ones plus the families built from ids at runtime. */
export function usedKeys() {
	const keys = new Set();
	const dynamic = new Set();
	for (const name of readdirSync(new URL("src/client/", root))) {
		const src = read("src/client/" + name);
		for (const m of src.matchAll(/\b(t|tOr)\("([^"]+)"(\s*\+)?/g)) {
			if (m[3]) dynamic.add(m[2]);
			else if (m[1] === "t") keys.add(m[2]);
		}
		// Keys picked indirectly, e.g. t(on ? "toast.autoOn" : "toast.autoOff") or act(..., "sync.restored"):
		// any other string literal shaped like a key in one of the dictionary's namespaces.
		for (const m of src.matchAll(/"([^"\s]+)"/g)) {
			if (KEY.test(m[1]) && NAMESPACES.has(m[1].split(".")[0]) && !m[1].endsWith(".")) keys.add(m[1]);
		}
	}
	const ids = (list) => list.map((x) => x.id);
	const families = {
		"tab.": ["themes", "editor", "gallery", "style", "identity", "persona", "prompts", "alerts", "usage", "sync", "advanced", "updates", "credits"],
		"palette.group.": ["themes", "looks", "appearance", "layout", "ambience", "prompts", "ai", "sync", "updates", "studio"],
		"ambience.": ids(shared.AMBIENCES),
		"material.": ids(shared.MATERIALS),
		"radius.": ids(shared.RADII),
		"sound.": ids(shared.SOUNDS),
		"width.": ids(shared.CHAT_WIDTHS),
		"toast.appearance.": ["light", "dark", "system"],
		"alerts.permission.": ["granted", "default", "denied", "unsupported"],
		"sync.source.": ["saved", "credential", "env", "null"],
		"updates.blocker.": ["local-copy", "not-from-github", "no-plugin-manager", "no-repository"],
		"usage.": ["today", "week", "month", "all"],
	};
	// tOr() families fall back to built-in text, so they're optional (checked only for consistency).
	const optional = ["font.", "look.", "lookDesc.", "themeDesc.", "persona.style.", "persona.styleHint."];
	for (const prefix of dynamic) {
		if (families[prefix]) for (const id of families[prefix]) keys.add(prefix + id);
		else if (!optional.includes(prefix)) keys.add(prefix + "*UNKNOWN-FAMILY*");
	}
	return keys;
}

export const placeholders = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

export function checkLocales() {
	const problems = [];
	const en = JSON.parse(read("locales/en.json"));
	for (const key of usedKeys()) if (!(key in en)) problems.push(`en: missing "${key}"`);
	const codes = shared.LANGUAGES.map((l) => l.code);
	const files = readdirSync(new URL("locales/", root)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
	for (const code of codes) if (!files.includes(code)) problems.push(`${code}: no locales/${code}.json`);
	for (const code of files) {
		if (!codes.includes(code)) problems.push(`${code}: not in LANGUAGES`);
		if (code === "en") continue;
		let dict;
		try {
			dict = JSON.parse(read(`locales/${code}.json`));
		} catch (e) {
			problems.push(`${code}: invalid JSON (${e.message})`);
			continue;
		}
		for (const key of Object.keys(en)) {
			if (!(key in dict)) problems.push(`${code}: missing "${key}"`);
			else if (typeof dict[key] !== "string" || !dict[key].trim()) problems.push(`${code}: empty "${key}"`);
			else if (placeholders(dict[key]) !== placeholders(en[key])) problems.push(`${code}: "${key}" placeholders {${placeholders(dict[key])}} ≠ English {${placeholders(en[key])}}`);
		}
		for (const key of Object.keys(dict)) if (!(key in en)) problems.push(`${code}: extra "${key}"`);
	}
	return { problems, languages: files.length, keys: Object.keys(en).length };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const { problems, languages, keys } = checkLocales();
	for (const p of problems) console.log(p);
	console.log(problems.length ? `\n${problems.length} problem(s)` : `OK: ${languages} languages × ${keys} keys`);
	process.exit(problems.length ? 1 : 0);
}
