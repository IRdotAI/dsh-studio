// node test/selftest.mjs — dependency-free checks for the shared core and the built bundle.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PRESETS, themeTokens, contrast, hexToOklch, oklchToHex, normHex, sanitizeState, defaultState, mergePatch,
	buildCss, personaPrompt, renderGreeting, randomTheme, resolveTheme, CSS_MARKER, LOOKS, parseVersion, compareVersions,
	extractPalette, themeFromPalette, withAccent, scheduleSlot, promptPlaceholders, fillPrompt, usageSummary,
	matchLanguage, cleanGalleryTheme, LANGUAGES, STOCK_THEME,
} from "../lib/shared.js";
import { UsageLog } from "../lib/usage.js";
import { GistSync } from "../lib/sync.js";
import { checkLocales } from "../scripts/check-locales.mjs";

let passed = 0;
const pending = [];
const test = (name, fn) => {
	const run = async () => {
		try {
			await fn();
			passed++;
			console.log("  ok  " + name);
		} catch (error) {
			console.error("FAIL  " + name + "\n" + (error?.stack ?? error));
			process.exitCode = 1;
		}
	};
	pending.push(run);
};

test("hex ↔ OKLCH round-trips exactly", () => {
	for (const hex of ["#4176e6", "#151517", "#ffffff", "#000000", "#bd93f9", "#fabd2f", "#002b36"]) {
		assert.equal(oklchToHex(hexToOklch(hex)), hex);
	}
});

test("out-of-gamut colours are chroma-reduced, never invalid", () => {
	const hex = oklchToHex({ l: 0.7, c: 0.6, h: 140 });
	assert.match(hex, /^#[0-9a-f]{6}$/);
});

test("every preset lands its anchors exactly and keeps text readable in both modes", () => {
	for (const p of PRESETS) {
		const t = themeTokens(p);
		assert.equal(t.dark["--dsw-static-neutral-bluish-950"], p.dark.bg, p.id);
		assert.equal(t.dark["--dsw-static-neutral-bluish-50"], p.dark.fg, p.id);
		assert.equal(t.dark["--dsw-static-deepseek-400"], p.dark.accent, p.id);
		assert.equal(t.light["--dsw-static-neutral-bluish-00"], p.light.bg, p.id);
		assert.equal(t.light["--dsw-static-neutral-bluish-1000"], p.light.fg, p.id);
		assert.equal(t.light["--dsw-static-deepseek-500"], p.light.accent, p.id);
		const d = (s) => t.dark["--dsw-static-neutral-bluish-" + s];
		const l = (s) => t.light["--dsw-static-neutral-bluish-" + s];
		assert.ok(contrast(d("300"), p.dark.bg) >= 4.4, `${p.id} dark secondary`);
		assert.ok(contrast(d("400"), p.dark.bg) >= 3.1, `${p.id} dark tertiary`);
		assert.ok(contrast(l("700"), p.light.bg) >= 4.4, `${p.id} light secondary`);
		assert.ok(contrast(l("600"), p.light.bg) >= 3.1, `${p.id} light tertiary`);
		assert.ok(contrast(p.light.accent, p.light.bg) >= 4.3, `${p.id} light accent`);
		assert.ok(contrast(p.dark.accent, p.dark.bg) >= 4.3, `${p.id} dark accent`);
	}
});

test("preset ids are unique and resolvable", () => {
	const ids = PRESETS.map((p) => p.id);
	assert.equal(new Set(ids).size, ids.length);
	for (const id of ids) assert.equal(resolveTheme({ theme: { active: id }, customThemes: [] })?.id, id);
});

test("sanitizeState repairs garbage without throwing", () => {
	const s = sanitizeState({
		theme: { active: "custom:nope", tint: 99 },
		style: { uiFont: "comic", ambienceStrength: -5, uiFontCustom: "x;}body{display:none" },
		wallpaper: { src: "javascript:alert(1)" },
		identity: { mark: "rocket", markText: "TOOLONG" },
		customThemes: [{ id: "ok", name: "Fine", dark: { bg: "#000", fg: "#fff", accent: "#f0f" }, light: { bg: "#fff", fg: "#000", accent: "#00f" } }, { id: "bad", dark: {} }],
		prompts: [{ id: "a", title: "A", text: "x" }, { id: "a", title: "dupe", text: "y" }, { id: "../evil", text: "z" }],
	});
	assert.equal(s.theme.active, "default");
	assert.equal(s.theme.tint, 2);
	assert.equal(s.style.uiFont, "default");
	assert.equal(s.style.ambienceStrength, 0);
	assert.ok(!/[;{}]/.test(s.style.uiFontCustom));
	assert.equal(s.wallpaper.src, "");
	assert.equal(s.identity.mark, "default");
	assert.equal(s.identity.markText.length, 3);
	assert.deepEqual(s.customThemes.map((t) => t.id), ["ok"]);
	assert.equal(s.customThemes[0].dark.bg, "#000000");
	assert.deepEqual(s.prompts.map((p) => p.id), ["a"]);
	assert.deepEqual(sanitizeState(null), defaultState());
});

test("mergePatch deep-merges objects and replaces arrays", () => {
	const merged = mergePatch({ a: { b: 1, c: 2 }, list: [1, 2, 3] }, { a: { c: 9 }, list: [4] });
	assert.deepEqual(merged, { a: { b: 1, c: 9 }, list: [4] });
});

test("buildCss: stock state is a near-empty sheet with the marker", () => {
	const css = buildCss(defaultState());
	assert.ok(css.startsWith(CSS_MARKER));
	assert.ok(!css.includes("--dsw-static-neutral-bluish"));
});

test("buildCss: theme, fonts, greeting (escaped), wallpaper", () => {
	const s = sanitizeState({
		theme: { active: "dracula" },
		style: { uiFont: "segoe", radius: "round", ambience: "grain" },
		identity: { name: 'Al "the" \\Pal', greeting: true },
		wallpaper: { src: "https://example.com/a.jpg", strength: 40, blur: 6 },
	});
	const css = buildCss(s, { now: new Date(2026, 9, 7, 9, 0) });
	assert.ok(css.includes("--dsw-static-neutral-bluish-950:#282a36"));
	assert.ok(css.includes("Segoe UI Variable"));
	assert.ok(css.includes("--dsw-radius-panel:48px"));
	assert.ok(css.includes('content:"Good morning, Al \\"the\\" \\\\Pal"'));
	assert.ok(css.includes('url("https://example.com/a.jpg")'));
	assert.ok(css.includes("filter:blur(6px)"));
	assert.ok(css.includes("color-mix(in srgb, var(--dsw-static-neutral-bluish-950) 60%, transparent)"));
});

test("buildCss: previewTheme overrides the saved theme; null previews stock", () => {
	const s = sanitizeState({ theme: { active: "nord" } });
	assert.ok(buildCss(s, { previewTheme: PRESETS[0] }).includes(PRESETS[0].dark.bg));
	assert.ok(!buildCss(s, { previewTheme: null }).includes("--dsw-static-neutral-bluish-950"));
});

test("glass: translucent surfaces, menu blur, harvested selectors in a forgiving :is()", () => {
	const s = sanitizeState({
		style: { material: "glass", glassBlur: 30, glassOpacity: 40, accentBubbles: true },
		cache: { glassSelectors: [".a_sidebar", ".b_composer .c_inner", ".x{}body{display:none", "a::before", ".ok:not(.no)"] },
	});
	assert.deepEqual(s.cache.glassSelectors, [".a_sidebar", ".b_composer .c_inner", ".ok:not(.no)"]);
	const css = buildCss(s);
	assert.ok(css.includes("--dsw-menu-backdrop-filter:blur(30px) saturate(170%)"));
	assert.ok(css.includes("--dsw-specific-sidebar-fill:color-mix(in srgb, color-mix(in srgb, var(--dsw-static-neutral-bluish-900), white 7%) 40%, transparent)"));
	assert.ok(css.includes("--dsw-specific-bubble:color-mix(in srgb, color-mix(in srgb, color-mix(in srgb, var(--dsw-static-deepseek-400) 20%"), "accent bubble wrapped in glass");
	assert.ok(css.includes("html:root body :is(.a_sidebar,.b_composer .c_inner,.ok:not(.no)){-webkit-backdrop-filter:var(--studio-glass-filter)"));
	assert.ok(!buildCss(sanitizeState({ cache: s.cache })).includes("backdrop-filter"), "solid material emits no glass");
});

test("desktop wallpaper and served font faces", () => {
	const s = sanitizeState({ wallpaper: { src: "desktop" }, style: { uiFont: "folder", fontDir: "C:\\fonts" } });
	assert.equal(s.wallpaper.src, "desktop");
	const css = buildCss(s, { fontFaces: [{ url: "/api/studio/font?f=SF-Pro-Display-Medium.otf", weight: 500, style: "normal" }] });
	assert.ok(css.includes('url("/api/studio/desktop-wallpaper")'));
	assert.ok(css.includes('@font-face{font-family:"Studio Local Font";src:url("/api/studio/font?f=SF-Pro-Display-Medium.otf");font-weight:500'));
	assert.ok(css.includes('--dsw-font-family:"Studio Local Font"'));
});

test("the Liquid Glass look resolves to a valid, glassy state", () => {
	const look = LOOKS.find((l) => l.id === "liquid-glass-desktop");
	const s = sanitizeState(mergePatch(defaultState(), look.patch));
	assert.equal(s.theme.active, "liquid-glass");
	assert.equal(s.style.material, "glass");
	assert.equal(s.wallpaper.src, "desktop");
	const t = themeTokens(resolveTheme(s));
	assert.equal(t.dark["--studio-accent-2"], "#5ad8e0");
	assert.equal(t.dark["--dsw-static-neutral-bluish-950"], "#040506");
});

test("an image logo without an image falls back to the original logo", () => {
	assert.equal(sanitizeState({ identity: { mark: "image", markImage: "" } }).identity.mark, "default");
	const png = "data:image/png;base64,iVBORw0KGgo=";
	const kept = sanitizeState({ identity: { mark: "image", markImage: png } }).identity;
	assert.equal(kept.mark, "image");
	assert.equal(kept.markImage, png);
	// What the × button sends: back to the original, image gone.
	const removed = sanitizeState(mergePatch({ identity: kept }, { identity: { mark: "default", markImage: "" } })).identity;
	assert.deepEqual([removed.mark, removed.markImage], ["default", ""]);
});

test("version ordering for updates and downgrades", () => {
	assert.deepEqual(parseVersion("v1.2.3"), { major: 1, minor: 2, patch: 3, pre: "" });
	assert.equal(parseVersion("latest"), null);
	assert.ok(compareVersions("1.3.0", "1.2.9") > 0);
	assert.ok(compareVersions("v1.10.0", "1.9.9") > 0, "numeric, not alphabetical");
	assert.ok(compareVersions("1.2.0", "1.2.0") === 0);
	assert.ok(compareVersions("1.3.0-beta.1", "1.3.0") < 0, "a pre-release sorts below its release");
	assert.ok(compareVersions("1.3.0-beta.2", "1.3.0-beta.1") > 0);
	assert.ok(compareVersions("garbage", "0.0.1") < 0);
	const sorted = ["1.1.0", "1.3.0", "1.2.0", "1.3.0-rc.1"].sort((a, b) => compareVersions(b, a));
	assert.deepEqual(sorted, ["1.3.0", "1.3.0-rc.1", "1.2.0", "1.1.0"]);
	assert.equal(sanitizeState({}).updates.auto, false);
	assert.equal(sanitizeState({ updates: { auto: true } }).updates.auto, true);
	assert.equal(sanitizeState({ updates: { auto: "yes" } }).updates.auto, false);
});

test("greeting drops the dangling comma when no name is set", () => {
	const s = sanitizeState({ identity: { greeting: true } });
	assert.equal(renderGreeting(s, new Date(2026, 9, 7, 21, 0)), "Good evening");
	const named = sanitizeState({ identity: { greeting: true, name: "Sam", greetingTemplate: "Happy {day}, {name}!" } });
	assert.equal(renderGreeting(named, new Date(2026, 9, 7, 21, 0)), "Happy Wednesday, Sam!");
});

test("persona prompt is empty unless enabled and filled", () => {
	assert.equal(personaPrompt(defaultState()), "");
	assert.equal(personaPrompt(sanitizeState({ persona: { enabled: true } })), "");
	const text = personaPrompt(sanitizeState({ identity: { name: "Sam" }, persona: { enabled: true, style: "concise", language: "British English", instructions: "Prefer pnpm." } }));
	assert.match(text, /^# Personal preferences/);
	assert.match(text, /Their name is Sam/);
	assert.match(text, /lead with the answer/);
	assert.match(text, /Reply in British English/);
	assert.match(text, /## Their custom instructions\nPrefer pnpm\./);
});

test("randomTheme always yields a valid, savable theme", () => {
	let seed = 1;
	const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	for (let i = 0; i < 50; i++) {
		const t = randomTheme(rand);
		const s = sanitizeState({ customThemes: [t], theme: { active: "custom:" + t.id } });
		assert.equal(s.theme.active, "custom:surprise");
		for (const mode of ["dark", "light"]) assert.ok(normHex(t[mode].bg) && normHex(t[mode].fg) && normHex(t[mode].accent));
		assert.ok(contrast(t.dark.fg, t.dark.bg) >= 7);
		assert.ok(contrast(t.light.fg, t.light.bg) >= 7);
	}
});

test("built browser bundle registers through the ModuleLoader and exports apply/inject", () => {
	const source = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
	let registered;
	const fakeReact = new Proxy({ createElement: () => null, Children: { toArray: (c) => c } }, { get: (t, k) => t[k] ?? (() => null) });
	const window = { __ModuleLoader__: { load: (spec) => { registered = spec; } } };
	new Function("window", source)(window);
	assert.equal(registered.id, "dsh-studio");
	const exports = registered.factory((name) => {
		if (name === "react") return fakeReact;
		throw new Error("unexpected require " + name);
	});
	assert.equal(typeof exports.apply, "function");
	assert.deepEqual(exports.inject, ["slots"]);
});

/** Pixels (RGBA) for a fake image: mostly `base`, with a block of `accent`. */
function fakeImage(base, accent, size = 40) {
	const data = new Uint8ClampedArray(size * size * 4);
	for (let i = 0; i < size * size; i++) {
		const [r, g, b] = i % size < size / 4 ? accent : base;
		data.set([r, g, b, 255], i * 4);
	}
	return data;
}

test("theme from an image: readable in both modes, accent taken from the picture", () => {
	const images = [
		fakeImage([12, 18, 40], [255, 90, 160]), // navy with hot pink
		fakeImage([240, 236, 220], [30, 140, 70]), // cream with green
		fakeImage([90, 90, 90], [90, 90, 90]), // plain grey: no vivid colours at all
	];
	for (const data of images) {
		const theme = themeFromPalette(extractPalette(data), "Test");
		const s = sanitizeState({ customThemes: [{ id: "img", ...theme }] });
		assert.equal(s.customThemes.length, 1, "valid, savable theme");
		for (const mode of ["dark", "light"]) {
			const m = theme[mode];
			assert.ok(contrast(m.fg, m.bg) >= 7, `${mode} text ${contrast(m.fg, m.bg)}`);
			assert.ok(contrast(m.accent, m.bg) >= 4.5, `${mode} accent ${contrast(m.accent, m.bg)}`);
			assert.ok(contrast(m.accent2, m.bg) >= 3, `${mode} accent2`);
		}
	}
	const pink = themeFromPalette(extractPalette(images[0]));
	const hue = hexToOklch(pink.dark.accent).h;
	assert.ok(hue > 320 || hue < 20, `accent keeps the pink hue (${hue})`);
});

test("Windows accent recolours the theme but never previews", () => {
	const s = sanitizeState({ theme: { active: "nord" }, followWindows: { accent: true } });
	const css = buildCss(s, { windowsAccent: "#680081" });
	const fitted = withAccent(PRESETS.find((p) => p.id === "nord"), "#680081");
	assert.ok(css.includes(`--dsw-static-deepseek-400:${fitted.dark.accent}`));
	assert.ok(contrast(fitted.dark.accent, fitted.dark.bg) >= 4.5 && contrast(fitted.light.accent, fitted.light.bg) >= 4.5);
	assert.ok(!buildCss(s, { windowsAccent: "#680081", previewTheme: PRESETS[0] }).includes(fitted.dark.accent), "previews show themes as they are");
	assert.ok(buildCss(sanitizeState({ followWindows: { accent: true } }), { windowsAccent: "#680081" }).includes(withAccent(STOCK_THEME, "#680081").dark.accent), "stock theme too");
});

test("schedule: the latest slot that has started, wrapping past midnight, with a stable key", () => {
	const entries = [{ time: "07:00", target: "theme:paper" }, { time: "19:30", target: "look:night" }];
	const at = (h, m) => scheduleSlot(entries, new Date(2026, 9, 7, h, m));
	assert.equal(at(8, 0).entry.target, "theme:paper");
	assert.equal(at(19, 30).entry.target, "look:night");
	assert.equal(at(2, 0).entry.target, "look:night", "before the first slot: yesterday's last one");
	assert.equal(at(2, 0).key, "2026-10-06@19:30#look:night");
	assert.equal(at(8, 0).key, at(18, 59).key, "same slot, same key");
	assert.notEqual(at(18, 59).key, at(19, 30).key);
	assert.equal(scheduleSlot([], new Date()), null);
	const s = sanitizeState({ schedule: { enabled: true, entries: [{ time: "25:00", target: "theme:x" }, { time: "07:00", target: "rm -rf" }, { time: "09:15", target: "builtin:liquid-glass-desktop" }] } });
	assert.deepEqual(s.schedule.entries, [{ time: "09:15", target: "builtin:liquid-glass-desktop" }]);
});

test("prompt placeholders: clipboard, date, labelled questions", () => {
	const text = "Review {clipboard} for {ask:Audience} on {day}. Again: {ask:Audience}, {ask}, {ask:Tone}";
	assert.deepEqual(promptPlaceholders(text), { clipboard: true, asks: ["Audience", "Answer", "Tone"] });
	const filled = fillPrompt(text, { clipboard: "CODE", answers: { Audience: "juniors", Answer: "yes", Tone: "kind" }, now: new Date(2026, 9, 7), locale: "en-GB" });
	assert.equal(filled, "Review CODE for juniors on Wednesday. Again: juniors, yes, kind");
	assert.deepEqual(promptPlaceholders("plain {name} text"), { clipboard: false, asks: [] });
	assert.equal(fillPrompt("{clipboard}{ask:X}"), "", "missing answers become empty, never 'undefined'");
});

test("usage summary: rolling windows, per-model totals, prices", () => {
	const now = new Date(2026, 9, 7, 12, 0);
	const day = 86_400_000;
	const records = [
		{ t: now.getTime() - 1000, m: "deepseek-chat", a: 1000, o: 500, r: 3000, w: 0 },
		{ t: now.getTime() - 3 * day, m: "deepseek-chat", a: 2000, o: 100, r: 0, w: 1000 },
		{ t: now.getTime() - 20 * day, m: "deepseek-reasoner", a: 100, o: 900, r: 0, w: 0 },
		{ t: now.getTime() - 60 * day, m: "deepseek-chat", a: 1, o: 1, r: 0, w: 0 },
	];
	const prices = { "deepseek-chat": { input: 0.27, output: 1.1, cacheRead: 0.07 } };
	const s = usageSummary(records, prices, now);
	assert.deepEqual([s.today.calls, s.week.calls, s.month.calls, s.all.calls], [1, 2, 3, 4]);
	assert.equal(s.today.tokens, 4500);
	assert.equal(s.week.input, 4000, "cache writes count as input");
	assert.equal(s.models["deepseek-chat"].calls, 3);
	assert.ok(Math.abs(s.today.cost - (1000 * 0.27 + 500 * 1.1 + 3000 * 0.07) / 1e6) < 1e-12);
	assert.equal(s.models["deepseek-chat"].priced, true);
	assert.equal(s.models["deepseek-reasoner"].priced, false, "no price set");
	assert.equal(s.month.priced, false);
	assert.equal(s.days.length, 30);
	assert.equal(s.days.at(-1).tokens, 4500);
});

test("usage recorder passes chunks through untouched and records the usage chunk", async () => {
	const dir = mkdtempSync(join(tmpdir(), "studio-usage-"));
	try {
		const log = new UsageLog(join(dir, "usage.json"));
		const listener = log.recorder();
		const chunks = [{ type: "text", text: "hi" }, { type: "usage", usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 90 } }, { type: "finish", reason: { kind: "stop" } }];
		const seen = [];
		for await (const c of listener({ provider: "deepseek", model: "deepseek-chat" }, () => (async function* () { yield* chunks; })())) seen.push(c);
		assert.deepEqual(seen, chunks);
		assert.equal(log.records.length, 1);
		assert.deepEqual({ ...log.records[0], t: 0, d: 0 }, { t: 0, p: "deepseek", m: "deepseek-chat", a: 10, o: 5, r: 90, w: 0, d: 0, ok: true });
		// A failing stream is recorded as failed and still throws to the harness.
		const failing = listener({ provider: "deepseek", model: "x" }, () => (async function* () { yield { type: "text" }; throw new Error("boom"); })());
		await assert.rejects(async () => { for await (const _ of failing) { /* drain */ } }, /boom/);
		assert.equal(log.records.at(-1).ok, false);
		log.flush();
		assert.equal(new UsageLog(join(dir, "usage.json")).records.length, 2, "persists");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("settings sync: private gist, images stay local unless included, restore keeps local images", async () => {
	const dir = mkdtempSync(join(tmpdir(), "studio-sync-"));
	const realFetch = globalThis.fetch;
	const calls = [];
	let gist = null;
	globalThis.fetch = async (url, init = {}) => {
		calls.push({ url: String(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body });
		const ok = (body) => ({ ok: true, status: 200, json: async () => body });
		if (String(url).endsWith("/user")) return ok({ login: "RdotA" });
		if (String(url).includes("/gists?")) return ok(gist ? [gist] : []);
		if (init.method === "POST") { gist = { id: "abc123", description: JSON.parse(init.body).description, files: {} }; Object.assign(gist.files, Object.fromEntries(Object.entries(JSON.parse(init.body).files).map(([k, v]) => [k, { content: v.content }]))); return ok(gist); }
		if (init.method === "PATCH") { Object.assign(gist.files, Object.fromEntries(Object.entries(JSON.parse(init.body).files).map(([k, v]) => [k, { content: v.content }]))); return ok(gist); }
		return ok(gist);
	};
	try {
		let state = sanitizeState({ wallpaper: { src: "data:image/jpeg;base64,AAAA" }, identity: { name: "RdotA" }, theme: { active: "dracula" } });
		let restored = null;
		const sync = new GistSync({ dataDir: dir, getState: () => state, setGistId: (id) => { state = sanitizeState(mergePatch(state, { sync: { gistId: id } })); }, restore: (s) => { restored = s; }, version: "2.0.0" });
		await assert.rejects(sync.setToken("not-a-token"), /doesn't look like a GitHub token/);
		await sync.setToken("ghp_" + "x".repeat(36));
		assert.equal((await sync.status()).login, "RdotA");
		await sync.push();
		const create = calls.find((c) => c.method === "POST");
		const sent = JSON.parse(create.body);
		assert.equal(sent.public, false, "private gist");
		const settings = JSON.parse(Object.values(sent.files)[0].content).settings;
		assert.notEqual(settings.wallpaper.src, state.wallpaper.src, "uploaded images stay on this computer by default");
		assert.equal(settings.cache, undefined);
		assert.equal(state.sync.gistId, "abc123");
		assert.ok(calls.every((c) => !String(c.url).includes("ghp_")), "token never in a URL");
		// Restore on "another computer" keeps that computer's own wallpaper.
		state = sanitizeState({ wallpaper: { src: "data:image/png;base64,BBBB" }, sync: { gistId: "abc123" } });
		await sync.pull();
		assert.equal(restored.theme.active, "dracula");
		assert.equal(restored.wallpaper.src, "data:image/png;base64,BBBB");
	} finally {
		globalThis.fetch = realFetch;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("languages: matching browser tags, every translation complete and consistent", () => {
	assert.equal(matchLanguage(["zh-Hant-TW"]), "zh-TW");
	assert.equal(matchLanguage(["zh-SG", "en"]), "zh-CN");
	assert.equal(matchLanguage(["pt-PT"]), "pt-BR");
	assert.equal(matchLanguage(["de-AT"]), "de");
	assert.equal(matchLanguage(["xx", "ja-JP"]), "ja");
	assert.equal(matchLanguage(["tlh"]), "en");
	assert.equal(sanitizeState({ language: "fr" }).language, "fr");
	assert.equal(sanitizeState({ language: "klingon" }).language, "auto");
	assert.equal(LANGUAGES.find((l) => l.code === "ar").dir, "rtl");
	const { problems, languages, keys } = checkLocales();
	assert.deepEqual(problems, []);
	assert.equal(languages, LANGUAGES.length);
	assert.ok(keys > 500);
});

test("greeting speaks the chosen language; custom templates keep working", () => {
	const dict = JSON.parse(readFileSync(new URL("../locales/ja.json", import.meta.url), "utf8"));
	const ja = { tr: (k) => dict[k], locale: "ja" };
	const morning = new Date(2026, 9, 7, 8, 0);
	assert.equal(renderGreeting(sanitizeState({ identity: { name: "RdotA" } }), morning, ja), "おはようございます、RdotAさん");
	assert.equal(renderGreeting(sanitizeState({}), morning, ja), "おはようございます");
	assert.equal(renderGreeting(sanitizeState({ identity: { name: "RdotA", greetingTemplate: "{timeOfDay}だね、{name}" } }), morning, ja), "朝だね、RdotA");
	const css = buildCss(sanitizeState({ identity: { greeting: true, name: "RdotA" } }), { now: morning, greetingLang: ja });
	assert.ok(css.includes('content:"おはようございます、RdotAさん"'));
});

test("gallery themes are validated and the shipped gallery is readable", () => {
	assert.equal(cleanGalleryTheme({ id: "../x", dark: {}, light: {} }), null);
	const t = cleanGalleryTheme({ id: "ok", name: "OK", author: "RdotA", dark: { bg: "#000", fg: "#fff", accent: "#0af" }, light: { bg: "#fff", fg: "#000", accent: "#05a" }, extra: "dropped" });
	assert.deepEqual(Object.keys(t).sort(), ["author", "dark", "description", "emoji", "id", "light", "name"]);
	const index = JSON.parse(readFileSync(new URL("../gallery/index.json", import.meta.url), "utf8"));
	assert.ok(index.themes.length >= 8);
	for (const theme of index.themes) {
		assert.deepEqual(cleanGalleryTheme(theme), theme, theme.id);
		for (const mode of ["dark", "light"]) {
			assert.ok(contrast(theme[mode].fg, theme[mode].bg) >= 7, `${theme.id} ${mode} text`);
			assert.ok(contrast(theme[mode].accent, theme[mode].bg) >= 3, `${theme.id} ${mode} accent`);
		}
	}
});

test("layout: chat width and interface scale", () => {
	const css = buildCss(sanitizeState({ layout: { chatWidth: "wide", scale: 115 } }));
	assert.ok(css.includes("--dsh-chat-user-width:1100px"));
	assert.ok(css.includes("html:root body>#root{zoom:1.15}"));
	assert.ok(!buildCss(defaultState()).includes("zoom"));
	assert.equal(sanitizeState({ layout: { scale: 500, chatWidth: "huge" } }).layout.scale, 140);
	assert.equal(sanitizeState({ layout: { chatWidth: "huge" } }).layout.chatWidth, "default");
});

for (const run of pending) await run();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
