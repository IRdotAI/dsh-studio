// node test/selftest.mjs — dependency-free checks for the shared core and the built bundle.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	PRESETS, themeTokens, contrast, hexToOklch, oklchToHex, normHex, sanitizeState, defaultState, mergePatch,
	buildCss, personaPrompt, renderGreeting, randomTheme, resolveTheme, CSS_MARKER, LOOKS, parseVersion, compareVersions,
} from "../lib/shared.js";

let passed = 0;
const test = (name, fn) => {
	try {
		fn();
		passed++;
		console.log("  ok  " + name);
	} catch (error) {
		console.error("FAIL  " + name + "\n" + (error?.stack ?? error));
		process.exitCode = 1;
	}
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

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
