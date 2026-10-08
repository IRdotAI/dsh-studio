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
	sunTimes, resolveEntryTime, budgetStatus, applyTargetToState, transcriptFromEvents, transcriptToMarkdown, markdownToHtml,
	cleanGalleryPack, StudioError, hostMessage, wallpaperUrl, slideIndex, workspaceTarget,
	EDITOR_MINIMUMS, MOODS, HARMONIES, themeFromColor, themeFromMood, themeFromWord, adjustTheme, mirrorMode, fixContrast,
	themeVariations, swapAccents, seededRandom, autoAccent2 } from "../lib/shared.js";
import { UsageLog } from "../lib/usage.js";
import { relaunchArgs, exitIntoChild } from "../lib/restart.js";
import { Updater } from "../lib/updater.js";
import { EventEmitter } from "node:events";
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

test("sunrise and sunset: London summer and winter, polar day and night", () => {
	const near = (date, hh, mm) => Math.abs(date.getUTCHours() * 60 + date.getUTCMinutes() - (hh * 60 + mm)) <= 5;
	const summer = sunTimes(new Date(2026, 5, 21), 51.5, -0.13);
	assert.ok(near(summer.sunrise, 3, 43) && near(summer.sunset, 20, 21), `${summer.sunrise.toISOString()} ${summer.sunset.toISOString()}`);
	const winter = sunTimes(new Date(2026, 11, 21), 51.5, -0.13);
	assert.ok(near(winter.sunrise, 8, 4) && near(winter.sunset, 15, 54), `${winter.sunrise.toISOString()} ${winter.sunset.toISOString()}`);
	assert.equal(sunTimes(new Date(2026, 11, 21), 69.65, 18.96).polar, "night");
	assert.equal(sunTimes(new Date(2026, 5, 21), 69.65, 18.96).polar, "day");
	assert.equal(resolveEntryTime("sunrise", new Date(), null), "07:00");
	assert.equal(resolveEntryTime("14:30", new Date(), { lat: 1, lon: 1 }), "14:30");
});

test("schedule with sunrise and sunset entries", () => {
	const loc = { lat: 51.5, lon: -0.1 };
	const day = new Date(2026, 3, 15, 12);
	const { sunrise, sunset } = sunTimes(day, loc.lat, loc.lon);
	const entries = [{ time: "sunrise", target: "theme:paper" }, { time: "sunset", target: "look:night" }];
	const at = (d) => scheduleSlot(entries, d, loc).entry.target;
	assert.equal(at(new Date(sunrise.getTime() + 3_600_000)), "theme:paper");
	assert.equal(at(new Date(sunset.getTime() + 120_000)), "look:night");
	assert.equal(at(new Date(sunrise.getTime() - 120_000)), "look:night", "before sunrise: yesterday's sunset");
	assert.equal(scheduleSlot(entries, new Date(sunset.getTime() + 120_000), loc).key.split("@")[1], "sunset#look:night", "keys use the entry, not the day's exact minute");
	const s = sanitizeState({ schedule: { entries: [{ time: "sunset", target: "theme:nord" }, { time: "noon", target: "theme:nord" }], location: { lat: 51.50735, lon: -0.12776 } } });
	assert.deepEqual(s.schedule.entries, [{ time: "sunset", target: "theme:nord" }]);
	assert.deepEqual(s.schedule.location, { lat: 51.5, lon: -0.1 }, "rounded to about 10 km");
});

test("budget: calendar day and month, warn and over levels, unpriced calls", () => {
	const now = new Date(2026, 9, 15, 12);
	const prices = { chat: { input: 1, output: 2, cacheRead: 0.5 } };
	const rec = (daysAgo, m = "chat") => ({ t: now.getTime() - daysAgo * 86_400_000, m, a: 1_000_000, o: 0, r: 0, w: 0 });
	const records = [rec(0), rec(0), rec(3), rec(20), rec(0, "mystery")];
	const status = budgetStatus(records, prices, { daily: 2.5, monthly: 2.8, warnAt: 80 }, now);
	assert.equal(status.daily.spent, 2);
	assert.equal(status.daily.level, "warn", "2 of 2.50 is past 80%");
	assert.equal(status.monthly.spent, 3, "the call 20 days ago was last month");
	assert.equal(status.monthly.level, "over");
	assert.equal(status.unpriced, 1);
	assert.equal(status.daily.period, "2026-10-15");
	assert.equal(budgetStatus(records, prices, { daily: null, monthly: null }, now).daily.level, "off");
	const s = sanitizeState({ usage: { budget: { daily: "5", monthly: 20, warnAt: 5 } } });
	assert.deepEqual(s.usage.budget, { daily: null, monthly: 20, warnAt: 10 });
});

test("AI modes: starter modes, validation, active mode must exist", () => {
	const d = defaultState();
	assert.deepEqual(d.persona.modes.map((m) => m.id), ["m_coding", "m_writing", "m_simple", "m_brainstorm"]);
	const s = sanitizeState({ persona: { modes: [{ id: "x", name: "X", style: "nonsense", instructions: "Be brief." }, { id: "x", name: "dupe" }, { id: "../y" }], mode: "x" } });
	assert.deepEqual(s.persona.modes, [{ id: "x", name: "X", emoji: "✨", style: "default", language: "", instructions: "Be brief." }]);
	assert.equal(s.persona.mode, "x");
	assert.equal(sanitizeState({ persona: { mode: "gone" } }).persona.mode, "");
});

test("workspace themes and other targets apply without saving", () => {
	const base = sanitizeState({
		theme: { active: "paper" },
		looks: [{ id: "night", name: "Night", theme: { active: "nord" }, style: { material: "glass" }, wallpaper: { src: "bing" } }],
		workspaceThemes: { ws_a: "look:night", ws_b: "theme:dracula", bad: "rm -rf" },
		cache: { workspace: "ws_b" },
	});
	assert.deepEqual(Object.keys(base.workspaceThemes), ["ws_a", "ws_b"]);
	assert.equal(applyTargetToState(base, "theme:nord").theme.active, "nord");
	const night = applyTargetToState(base, "look:night");
	assert.deepEqual([night.theme.active, night.style.material, night.wallpaper.src], ["nord", "glass", "bing"]);
	assert.equal(applyTargetToState(base, "builtin:liquid-glass-desktop").theme.active, "liquid-glass");
	assert.equal(applyTargetToState(base, "look:missing"), base);
	assert.ok(buildCss(base).includes("--dsw-static-neutral-bluish-950:#282a36"), "the remembered open workspace (Dracula) shows at first paint");
	assert.ok(buildCss(base, { workspace: "ws_c" }).includes("--dsw-static-neutral-bluish-950:" + PRESETS.find((p) => p.id === "paper").dark.bg), "other workspaces use the saved theme");
	assert.equal(base.theme.active, "paper", "nothing saved");
	const contrast = { ...base, theme: { ...base.theme, active: "high-contrast" } };
	assert.equal(workspaceTarget(contrast, "ws_b"), "", "High Contrast wins over a workspace theme");
	assert.ok(buildCss(contrast).includes("--dsw-static-neutral-bluish-950:#000000"), "and shows at first paint");
});

test("wallpapers: Bing, slideshow, video, and reduced transparency", () => {
	const now = new Date(2026, 9, 7);
	assert.equal(wallpaperUrl({ src: "bing" }, now), "/api/studio/bing-wallpaper?d=2026-10-07");
	assert.equal(wallpaperUrl({ src: "folder" }, now, 3), "/api/studio/wallpaper-file?i=3");
	assert.equal(slideIndex(5, 30, 7 * 30 * 60_000 + 10), 2);
	assert.equal(slideIndex(0, 30), 0);
	const video = sanitizeState({ wallpaper: { src: "video", video: "C:\\Videos\\rain.mp4", blur: 4 } });
	const css = buildCss(video);
	assert.ok(css.includes("html:root body>#studio-wall-video{position:fixed") && !css.includes("html:root::before"));
	assert.equal(sanitizeState({ wallpaper: { video: "C:\\evil.exe" } }).wallpaper.video, "");
	assert.equal(sanitizeState({ wallpaper: { video: "https://x.test/a.mp4" } }).wallpaper.video, "https://x.test/a.mp4");
	assert.equal(sanitizeState({ wallpaper: { src: "javascript:alert(1)" } }).wallpaper.src, "");
	const glassy = sanitizeState({ style: { material: "glass", reduceTransparency: true }, wallpaper: { src: "bing" }, cache: { glassSelectors: [".a"] } });
	const solid = buildCss(glassy);
	assert.ok(!solid.includes("backdrop-filter") && !solid.includes("bing-wallpaper"), "reduce transparency: no glass, no wallpaper");
	assert.ok(!buildCss({ ...glassy, style: { ...glassy.style, reduceTransparency: false } }, { reduceTransparency: true }).includes("backdrop-filter"), "the system setting counts too");
});

test("accessibility: easy-reading spacing, focus outlines, High Contrast", () => {
	assert.ok(buildCss(sanitizeState({ style: { uiFont: "readable" } })).includes("letter-spacing:.02em"));
	assert.ok(buildCss(sanitizeState({ style: { focusRings: true } })).includes(":focus-visible{outline:3px solid"));
	const hc = buildCss(sanitizeState({ theme: { active: "high-contrast" } }));
	assert.ok(hc.includes(":focus-visible") && hc.includes("--dsw-static-neutral-bluish-950:#000000"));
});

test("chat export: transcript from events, Markdown, and safe HTML", () => {
	const text = (t) => [{ type: "text", text: t }];
	const events = [
		{ type: "system/message", time: 1, data: { content: text("system prompt") } },
		{ type: "user/message", time: 2, data: { role: "user", source: { kind: "user" }, content: text("Fix the bug") } },
		{ type: "assistant/message", time: 3, data: { message: { content: [{ type: "reasoning", text: "thinking" }, { type: "tool-call", id: "1", name: "read_file", arguments: "{}" }] } } },
		{ type: "tool/result", time: 4, data: {} },
		{ type: "assistant/message", time: 5, data: { message: { content: text("Done, see below.") } } },
		{ type: "turn/end", time: 6, data: {} },
		{ type: "user/message", time: 7, data: { role: "user", source: { kind: "tool" }, content: text("not typed by a person") } },
		{ type: "user/message", time: 8, data: { role: "user", content: text("Thanks!") } },
		{ type: "assistant/message", time: 9, data: { message: { content: text("Any time.") } } },
	];
	const messages = transcriptFromEvents(events);
	assert.deepEqual(messages.map((m) => [m.role, m.text, m.tools]), [["user", "Fix the bug", []], ["assistant", "Done, see below.", ["read_file"]], ["user", "Thanks!", []], ["assistant", "Any time.", []]]);
	const md = transcriptToMarkdown({ title: "Bug", messages, exportedAt: new Date(2026, 9, 7) }, { you: "Me" });
	assert.ok(md.startsWith("# Bug\n") && md.includes("## Me\n\nFix the bug") && md.includes("> Tools used: `read_file`"));
	const html = markdownToHtml("# Hi <b>\n\n```js\nif (a < b) alert(1)\n```\n\n- one\n- **two**\n\n| a | b |\n|---|---|\n| 1 | `x` |\n\n[ok](https://example.com) [bad](javascript:alert(1)) <img src=x onerror=alert(1)>");
	assert.ok(html.includes("<h1>Hi &lt;b&gt;</h1>"));
	assert.ok(html.includes('<pre><code class="language-js">if (a &lt; b) alert(1)</code></pre>'));
	assert.ok(html.includes("<ul><li>one</li><li><strong>two</strong></li></ul>"));
	assert.ok(html.includes("<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td><code>x</code></td></tr></tbody></table>"));
	assert.ok(html.includes('<a href="https://example.com">ok</a>') && !html.includes('href="javascript'));
	assert.ok(!html.includes("<img") && html.includes("&lt;img"), "raw HTML in a chat is shown, never run");
});

test("gallery prompt packs are validated; the shipped packs are clean", () => {
	assert.equal(cleanGalleryPack({ id: "x", prompts: [] }), null);
	assert.equal(cleanGalleryPack({ id: "../x", prompts: [{ text: "a" }] }), null);
	const pack = cleanGalleryPack({ id: "p", name: "P", author: "RdotA", prompts: [{ title: "A", text: "a", folder: "F" }, { title: "empty", text: "  " }] });
	assert.deepEqual(pack.prompts, [{ title: "A", text: "a", folder: "F" }]);
	const index = JSON.parse(readFileSync(new URL("../gallery/index.json", import.meta.url), "utf8"));
	assert.ok(index.packs.length >= 4);
	for (const p of index.packs) assert.deepEqual(cleanGalleryPack(p), p, p.id);
});

test("host messages carry translatable codes, nested reasons and English fallbacks", () => {
	const inner = new StudioError("sync.noToken", {}, "no GitHub token yet");
	const msg = hostMessage(new StudioError("sync.backupFailed", { reason: inner }, "Backup failed: no GitHub token yet"));
	assert.deepEqual(msg, { code: "sync.backupFailed", params: { reason: { code: "sync.noToken", params: {}, text: "no GitHub token yet" } }, text: "Backup failed: no GitHub token yet" });
	assert.deepEqual(hostMessage(new Error("boom")), { code: "raw", params: { text: "boom" }, text: "boom" });
	assert.equal(hostMessage(Object.assign(new Error("x"), { name: "AbortError" })).code, "timeout");
	assert.equal(hostMessage(msg), msg, "already a message");
});

test("theme editor tools: moods, one colour, words, fine-tune, mirror, variations, fixes", () => {
	const readable = (theme, label) => {
		for (const mode of ["dark", "light"]) {
			const m = theme[mode];
			assert.ok(contrast(m.fg, m.bg) >= EDITOR_MINIMUMS.fg, `${label} ${mode}: text ${contrast(m.fg, m.bg).toFixed(2)}`);
			assert.ok(contrast(m.accent, m.bg) >= EDITOR_MINIMUMS.accent, `${label} ${mode}: accent`);
			assert.ok(contrast(m.accent2 ?? autoAccent2(m), m.bg) >= 1, `${label} ${mode}: accent2 exists`);
			if (m.accent2) assert.ok(contrast(m.accent2, m.bg) >= EDITOR_MINIMUMS.accent2, `${label} ${mode}: accent2`);
			assert.ok(sanitizeState({ customThemes: [{ id: "t", name: "t", ...theme }] }).customThemes.length === 1, `${label}: saves`);
		}
		assert.ok(hexToOklch(theme.dark.bg).l < hexToOklch(theme.dark.fg).l && hexToOklch(theme.light.bg).l > hexToOklch(theme.light.fg).l, `${label}: modes the right way round`);
	};
	const rand = seededRandom(7);
	for (const mood of MOODS) for (let i = 0; i < 25; i++) readable(themeFromMood(mood.id, mood.id, rand), "mood " + mood.id);
	assert.notDeepEqual(themeFromMood("calm", "Calm", seededRandom(1)).dark, themeFromMood("calm", "Calm", seededRandom(2)).dark, "each click is a new take");
	for (let i = 0; i < 120; i++) {
		const hex = oklchToHex({ l: rand(), c: rand() * 0.3, h: rand() * 360 });
		for (const h of HARMONIES) readable(themeFromColor(hex, h.id), `colour ${hex} ${h.id}`);
	}
	const purple = themeFromColor("#680081", "complementary");
	assert.equal(purple.light.accent, "#680081", "the picked colour is used as is where it reads well");
	assert.ok(Math.abs(hexToOklch(purple.dark.accent).h - hexToOklch("#680081").h) < 12, "and keeps its hue where it has to be lightened");
	assert.deepEqual([themeFromWord("RdotA").dark, themeFromWord("RdotA").light], [themeFromWord(" rdota ").dark, themeFromWord(" rdota ").light], "a word always makes the same colours");
	assert.equal(themeFromWord("midnight tokyo").name, "Midnight tokyo");
	for (const p of PRESETS) {
		readable(adjustTheme(p), "identity " + p.id);
		for (const v of themeVariations(p)) readable(v.theme, `variation ${p.id} ${v.id}`);
		readable(mirrorMode(p, "dark"), "mirror " + p.id);
		readable(mirrorMode(p, "light"), "mirror back " + p.id);
		readable(adjustTheme(p, { hue: 120, vivid: 2, warmth: 1, depth: -1 }), "extreme " + p.id);
		readable(adjustTheme(p, { hue: -120, vivid: 0, warmth: -1, depth: 1 }), "other extreme " + p.id);
	}
	const nord = PRESETS.find((p) => p.id === "nord");
	assert.deepEqual(adjustTheme(nord, { hue: 0 }).dark, { ...nord.dark }, "no adjustment, no change");
	assert.notEqual(adjustTheme(nord, { hue: 90 }).dark.accent, nord.dark.accent);
	const swapped = swapAccents(PRESETS[0]);
	assert.equal(swapped.dark.accent2, PRESETS[0].dark.accent, "accents swap places");
	const broken = { name: "x", dark: { bg: "#000000", fg: "#222222", accent: "#111111" }, light: { bg: "#ffffff", fg: "#eeeeee", accent: "#fafafa", accent2: "#ffffee" } };
	readable(fixContrast(broken), "fixed");
	assert.equal(fixContrast(PRESETS[0]).dark.fg, PRESETS[0].dark.fg, "colours that already read are left alone");
	assert.equal(autoAccent2(nord.dark), themeTokens(nord).dark["--studio-accent-2"], "the editor shows the same automatic second accent the app uses");
});

test("restarting after an update: same command line, handed over in place, only when idle for automatic updates", async () => {
	const bin = "C:\\npx\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js";
	assert.deepEqual(relaunchArgs(["node", bin, "web", "--port", "3080"], []), [bin, "web", "--port", "3080", "--no-open"], "no second browser tab");
	assert.deepEqual(relaunchArgs(["node", "/x/@deepseek-ai/dsh/lib/bin.js", "web", "--no-open"], ["--inspect"]), ["--inspect", "/x/@deepseek-ai/dsh/lib/bin.js", "web", "--no-open"]);
	assert.equal(relaunchArgs(["node", "/x/test/selftest.mjs"]), null, "not started by dsh: no restart");
	assert.equal(relaunchArgs(["node", bin, "plugin", "add", "x"]), null);

	// The shutdown's process.exit() starts the new harness instead, retries a busy port, then exits with the child's code.
	const exits = [];
	const children = [];
	const proc = { exit: (code) => exits.push(code), execPath: "node", cwd: () => "/w", env: { A: "1" } };
	const spawnFn = (cmd, args, opts) => {
		const child = Object.assign(new EventEmitter(), { pid: 100 + children.length, cmd, args, opts });
		children.push(child);
		return child;
	};
	exitIntoChild(["bin.js", "web"], { proc, spawnFn, retryMs: 5, startDelayMs: 5 });
	proc.exit(0);
	proc.exit(130); // a second exit while handing over changes nothing
	await new Promise((r) => setTimeout(r, 30));
	assert.equal(children.length, 1);
	assert.deepEqual([children[0].cmd, children[0].args, children[0].opts.stdio, children[0].opts.cwd], ["node", ["bin.js", "web"], "inherit", "/w"]);
	children[0].emit("exit", 1, null); // port still busy
	await new Promise((r) => setTimeout(r, 30));
	assert.equal(children.length, 2, "a quick startup failure is retried");
	assert.deepEqual(exits, []);
	children[1].emit("exit", 130, null); // later: Ctrl+C
	assert.deepEqual(exits, [130], "exits with the new harness's code");

	// The updater: an update you start restarts at once; an automatic one waits until no task has run for two checks.
	const dir = mkdtempSync(join(tmpdir(), "studio-updater-"));
	try {
		const make = (busy) => {
			const calls = { restart: 0 };
			const updater = new Updater({
				dataDir: dir, settingsFile: join(dir, "studio.json"), getAuto: () => false, setAuto: () => {},
				getRestartAfter: () => true, canRestart: () => true, restart: () => { calls.restart++; return true; },
				isBusy: () => busy.value, restartDelayMs: 5, idleCheckMs: 10,
			});
			Object.assign(updater, { repo: "o/r", source: { kind: "github" }, pluginManager: { installBundle: async () => ({ application: "restart-required" }) } });
			updater.releases = [{ version: "99.0.0", tag: "v99.0.0", name: "v99", notes: "", publishedAt: null, url: null, prerelease: false }];
			return { updater, calls };
		};
		const manual = make({ value: true });
		manual.updater.install("99.0.0", "manual");
		await new Promise((r) => setTimeout(r, 40));
		assert.equal(manual.calls.restart, 1, "manual updates restart right away, even mid-task (you asked for it)");
		assert.equal(manual.updater.snapshot().restarting, "99.0.0");
		const busy = { value: true };
		const auto = make(busy);
		auto.updater.install("99.0.0", "auto");
		await new Promise((r) => setTimeout(r, 60));
		assert.equal(auto.calls.restart, 0, "automatic updates don't restart while a task runs");
		assert.equal(auto.updater.snapshot().waitingForIdle, true);
		busy.value = false;
		await new Promise((r) => setTimeout(r, 60));
		assert.equal(auto.calls.restart, 1, "...and restart once things are quiet");
		auto.updater.stopWaiting();
		const off = make({ value: false });
		off.updater.getRestartAfter = () => false;
		off.updater.install("99.0.0", "manual");
		await new Promise((r) => setTimeout(r, 30));
		assert.equal(off.calls.restart, 0, "with the setting off, nothing restarts");
		off.updater.canRestart = () => false;
		assert.throws(() => off.updater.restartNow(), /restart itself/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

for (const run of pending) await run();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
