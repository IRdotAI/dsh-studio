//#region lib/shared.js
/**
 * dsh-studio shared core: colour maths, theme presets, palette generation,
 * the stylesheet builder, settings sanitising, and the persona prompt.
 *
 * Pure and dependency-free. The host imports it as ESM; scripts/build.mjs
 * inlines it (minus the `export` keywords) into the browser bundle, so both
 * halves render byte-identical CSS from the same state.
 */

//#region colour maths (OKLab / OKLCH, sRGB gamut-mapped)
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** "#abc" / "#aabbcc" → [r, g, b] in 0..1, or null. */
export function parseHex(hex) {
	if (typeof hex !== "string") return null;
	let h = hex.trim().replace(/^#/, "");
	if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
	if (!/^[0-9a-f]{6}$/i.test(h)) return null;
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function normHex(hex) {
	const rgb = parseHex(hex);
	return rgb ? toHex(rgb) : null;
}

function toHex(rgb) {
	return "#" + rgb.map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0")).join("");
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linearToOklab([r, g, b]) {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function oklabToLinear([L, a, b]) {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

/** Hex → { l (0..1), c (chroma), h (degrees) }, or null for an invalid hex. */
export function hexToOklch(hex) {
	const rgb = parseHex(hex);
	if (!rgb) return null;
	const [L, a, b] = linearToOklab(rgb.map(toLinear));
	let h = (Math.atan2(b, a) * 180) / Math.PI;
	if (h < 0) h += 360;
	return { l: L, c: Math.hypot(a, b), h };
}

function oklchToLinear({ l, c, h }) {
	const rad = (h * Math.PI) / 180;
	return oklabToLinear([l, c * Math.cos(rad), c * Math.sin(rad)]);
}

const inGamut = (lin) => lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** OKLCH → hex, reducing chroma (never lightness or hue) until the colour fits sRGB. */
export function oklchToHex({ l, c, h }) {
	l = clamp01(l);
	if (l >= 0.9999) return "#ffffff";
	if (l <= 0.0001) return "#000000";
	let lin = oklchToLinear({ l, c: Math.max(0, c), h });
	if (!inGamut(lin)) {
		let lo = 0;
		let hi = Math.max(0, c);
		for (let i = 0; i < 24; i++) {
			const mid = (lo + hi) / 2;
			if (inGamut(oklchToLinear({ l, c: mid, h }))) lo = mid;
			else hi = mid;
		}
		lin = oklchToLinear({ l, c: lo, h });
	}
	return toHex(lin.map((v) => fromLinear(clamp01(v))));
}

/** WCAG relative luminance. */
export function luminance(hex) {
	const rgb = parseHex(hex);
	if (!rgb) return 0;
	const [r, g, b] = rgb.map(toLinear);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours (1..21). */
export function contrast(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return (hi + 0.05) / (lo + 0.05);
}

function lerpHue(a, b, t) {
	const d = ((b - a + 540) % 360) - 180;
	return (a + d * t + 360) % 360;
}
//#endregion

//#region reference scales (dsh-client-ui-theme design-platform.css, 0.2.0-rc.2)
/**
 * The harness's own static scales. Every alias token (surfaces, labels,
 * borders, buttons, sidebar) points at one of these, so re-deriving the three
 * scales re-themes the whole app while keeping the designers' contrast ladder.
 */
const REF_SURFACE = {
	"00": "#ffffff", 50: "#f9fafb", 60: "#f5f6f7", 75: "#f1f3f5", 100: "#ebeef2", 150: "#e9ecf2", 200: "#e1e5ee",
	300: "#cfd3d6", 400: "#adb2b8", 500: "#979da6", 600: "#81858c", 700: "#61666b", 750: "#43454a", 800: "#353638",
	850: "#2c2c2e", 875: "#232324", 900: "#1b1b1c", 950: "#151517", 1000: "#0f1115",
};
const REF_NEUTRAL = {
	"00": "#ffffff", 50: "#fafafa", 100: "#f5f5f5", 150: "#ededed", 200: "#e5e5e5", 250: "#dcdcdc", 300: "#d4d4d4",
	400: "#a2a4a6", 500: "#7f8287", 550: "#65676b", 600: "#545557", 700: "#3c3c3d", 800: "#292929", 850: "#212123",
	900: "#0f0f0f", 1000: "#000000",
};
const REF_ACCENT = {
	50: "#edf3fe", 100: "#e4edfd", 200: "#d3e2ff", 300: "#b7c8fe", 400: "#7aaaff", 450: "#5686fe", 500: "#4176e6",
	600: "#4868b2", "700-delete": "#2f4c8f", 800: "#34415b", 900: "#283142",
};

const refCache = new Map();
function refOklch(table) {
	let out = refCache.get(table);
	if (!out) {
		out = Object.fromEntries(Object.entries(table).map(([k, hex]) => [k, hexToOklch(hex)]));
		refCache.set(table, out);
	}
	return out;
}

/** Steps the base background and the primary text sit on, per colour scheme. */
const ANCHORS = { dark: { bg: "950", fg: "50", accent: "400" }, light: { bg: "00", fg: "1000", accent: "500" } };

/**
 * Minimum WCAG contrast against the background for the text steps
 * (label-secondary / label-tertiary / dimmed labels), so a theme with soft
 * primary text never drags its secondary text into illegibility.
 */
const TEXT_FLOORS = { dark: { 300: 4.5, 400: 3.2 }, light: { 750: 7, 700: 4.6, 600: 3.2 } };
//#endregion

//#region palette generation
/**
 * Re-derive a neutral scale so the scheme's background step lands exactly on
 * `bg` and its text step exactly on `fg`. Every other step keeps its relative
 * lightness position between the two; chroma and hue blend from bg to fg.
 */
function surfaceScale(table, mode, bg, fg, chromaScale, exact) {
	const R = refOklch(table);
	const S = refOklch(REF_SURFACE);
	const { bg: bgStep, fg: fgStep } = ANCHORS[mode];
	const B = hexToOklch(bg);
	const F = hexToOklch(fg);
	const refBg = S[bgStep].l;
	const span = S[fgStep].l - refBg;
	const fgContrast = contrast(fg, bg);
	const out = {};
	for (const [step, r] of Object.entries(R)) {
		if (exact && step === bgStep) { out[step] = normHex(bg); continue; }
		if (exact && step === fgStep) { out[step] = normHex(fg); continue; }
		const t = (r.l - refBg) / span;
		const tc = clamp01(t);
		const l = B.l + t * (F.l - B.l);
		const c = (B.c + tc * (F.c - B.c)) * chromaScale;
		const h = B.c < 0.01 ? F.h : F.c < 0.01 ? B.h : lerpHue(B.h, F.h, tc);
		const floor = exact && TEXT_FLOORS[mode][step] ? Math.min(TEXT_FLOORS[mode][step], fgContrast * 0.9) : 0;
		out[step] = floor ? withContrastFloor({ l, c, h }, bg, floor, mode) : oklchToHex({ l, c, h });
	}
	return out;
}

/** Move a colour's lightness away from the background until it reaches `floor` contrast (or the scale's end). */
function withContrastFloor(lch, bg, floor, mode) {
	const hex = oklchToHex(lch);
	if (contrast(hex, bg) >= floor) return hex;
	const target = mode === "dark" ? 1 : 0;
	let lo = lch.l;
	let hi = target;
	for (let i = 0; i < 24; i++) {
		const mid = (lo + hi) / 2;
		if (contrast(oklchToHex({ ...lch, l: mid }), bg) >= floor) hi = mid;
		else lo = mid;
	}
	return oklchToHex({ ...lch, l: hi });
}

/**
 * Re-derive the accent scale around `accent`: the scheme's accent step is the
 * exact colour, lighter/darker steps keep the reference ladder's lightness
 * ends and chroma profile, all on the accent's hue.
 */
function accentScale(mode, accent) {
	const R = refOklch(REF_ACCENT);
	const anchor = ANCHORS[mode].accent;
	const A = hexToOklch(accent);
	const ra = R[anchor];
	const top = R["50"];
	const bottom = R["900"];
	const out = {};
	for (const [step, r] of Object.entries(R)) {
		if (step === anchor) { out[step] = normHex(accent); continue; }
		let l;
		if (r.l >= ra.l) l = A.l + ((r.l - ra.l) / (top.l - ra.l || 1)) * (Math.max(top.l, A.l) - A.l);
		else l = A.l - ((ra.l - r.l) / (ra.l - bottom.l || 1)) * (A.l - Math.min(bottom.l, A.l));
		out[step] = oklchToHex({ l, c: A.c * (r.c / (ra.c || 1)), h: A.h });
	}
	return out;
}

/** Alias tokens the stock sheets hard-code as hex; re-expressed over the scales so they follow the theme. */
const DERIVED_ALIASES = {
	light: {
		"--dsw-alias-interactive-bg-hover": "color-mix(in srgb, var(--dsw-static-neutral-bluish-900) 6%, transparent)",
		"--dsw-alias-interactive-bg-active": "color-mix(in srgb, var(--dsw-static-neutral-bluish-900) 10%, transparent)",
		"--dsw-alias-interactive-bg-hover-accent": "color-mix(in srgb, var(--dsw-static-neutral-bluish-900) 14%, transparent)",
		"--dsw-alias-brand-primary-new-colorprimary-new-color": "var(--dsw-static-deepseek-500)",
		"--dsw-alias-bg-mask-drop": "color-mix(in srgb, var(--dsw-static-neutral-bluish-00) 70%, transparent)",
		"--dsw-menu-surface-fill": "color-mix(in srgb, var(--dsw-static-neutral-bluish-50) 58%, transparent)",
		"--dsw-alias-menu-group-header-fill": "color-mix(in srgb, var(--dsw-static-neutral-bluish-50) 94%, transparent)",
	},
	dark: {
		"--dsw-alias-bg-mask-drop": "color-mix(in srgb, var(--dsw-static-neutral-bluish-900) 70%, transparent)",
		"--dsw-menu-surface-fill": "color-mix(in srgb, var(--dsw-static-neutral-bluish-750) 45%, transparent)",
		"--dsw-alias-menu-group-header-fill": "color-mix(in srgb, var(--dsw-static-neutral-bluish-800) 94%, transparent)",
	},
};

/** The second accent a scheme gets when it sets none: an analogous shift of the accent (pink→purple, blue→cyan, gold→orange). */
export function autoAccent2(m) {
	const a = hexToOklch(m.accent);
	return oklchToHex({ l: a.l, c: Math.max(0.09, a.c), h: (a.h + 305) % 360 });
}

/**
 * Full token set for one theme: { light: {var: value}, dark: {var: value} }.
 * @param theme { dark: {bg, fg, accent}, light: {bg, fg, accent} }
 * @param tint chroma multiplier for the neutral surfaces (0 = grey, 1 = as designed)
 */
export function themeTokens(theme, tint = 1) {
	const out = { light: {}, dark: {} };
	for (const mode of ["light", "dark"]) {
		const m = theme[mode];
		const tokens = out[mode];
		const surface = surfaceScale(REF_SURFACE, mode, m.bg, m.fg, tint, true);
		for (const [k, v] of Object.entries(surface)) tokens[`--dsw-static-neutral-bluish-${k}`] = v;
		const neutral = surfaceScale(REF_NEUTRAL, mode, m.bg, m.fg, tint * 0.5, false);
		for (const [k, v] of Object.entries(neutral)) tokens[`--dsw-static-neutral-${k}`] = v;
		const accent = accentScale(mode, m.accent);
		for (const [k, v] of Object.entries(accent)) tokens[`--dsw-static-deepseek-${k}`] = v;
		Object.assign(tokens, DERIVED_ALIASES[mode]);
		// A partner hue for gradients (aurora, monogram): the theme's own accent2, else autoAccent2.
		tokens["--studio-accent-2"] = normHex(m.accent2) ?? autoAccent2(m);
	}
	return out;
}
//#endregion

//#region presets
/** Curated themes. Each defines both schemes so the harness's Light/Dark/System switch keeps working. */
export const PRESETS = [
	{ id: "liquid-glass", name: "Liquid Glass", emoji: "🫧", description: "Clear frosted glass on true black, with magenta and cyan highlights.",
		dark: { bg: "#040506", fg: "#f2f2f7", accent: "#c968e6", accent2: "#5ad8e0" }, light: { bg: "#f2f2f7", fg: "#1c1c1e", accent: "#8e3aa7", accent2: "#0b7f89" } },
	{ id: "midnight", name: "Midnight", emoji: "🌌", description: "Deep navy with a periwinkle glow.",
		dark: { bg: "#0b1020", fg: "#e6e9f5", accent: "#8aa2ff" }, light: { bg: "#f6f8fd", fg: "#121a2e", accent: "#3a5bdb" } },
	{ id: "dracula", name: "Dracula", emoji: "🧛", description: "The classic purple-and-pink night palette.",
		dark: { bg: "#282a36", fg: "#f8f8f2", accent: "#bd93f9" }, light: { bg: "#f8f8f2", fg: "#282a36", accent: "#7b4fd6" } },
	{ id: "nord", name: "Nord", emoji: "🏔️", description: "Arctic, calm, low-glare blues.",
		dark: { bg: "#2e3440", fg: "#eceff4", accent: "#88c0d0" }, light: { bg: "#eceff4", fg: "#2e3440", accent: "#4a6d98" } },
	{ id: "tokyo-night", name: "Tokyo Night", emoji: "🌃", description: "Neon city lights on indigo.",
		dark: { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7" }, light: { bg: "#e6e7ed", fg: "#343b58", accent: "#2e5bd9" } },
	{ id: "catppuccin", name: "Catppuccin", emoji: "🐱", description: "Soft pastels: Mocha by night, Latte by day.",
		dark: { bg: "#1e1e2e", fg: "#cdd6f4", accent: "#cba6f7" }, light: { bg: "#eff1f5", fg: "#3f4259", accent: "#7a2ee0" } },
	{ id: "rose-pine", name: "Rosé Pine", emoji: "🌹", description: "Muted rose, gold and pine.",
		dark: { bg: "#191724", fg: "#e0def4", accent: "#ebbcba" }, light: { bg: "#faf4ed", fg: "#4a456b", accent: "#a1526a" } },
	{ id: "gruvbox", name: "Gruvbox", emoji: "🍂", description: "Retro, warm and earthy.",
		dark: { bg: "#282828", fg: "#ebdbb2", accent: "#fabd2f" }, light: { bg: "#fbf1c7", fg: "#3c3836", accent: "#af3a03" } },
	{ id: "solarized", name: "Solarized", emoji: "☀️", description: "Precision colours for machines and people.",
		dark: { bg: "#002b36", fg: "#eee8d5", accent: "#2aa198" }, light: { bg: "#fdf6e3", fg: "#073642", accent: "#1d70ad" } },
	{ id: "forest", name: "Forest", emoji: "🌲", description: "Moss, fern and morning mist.",
		dark: { bg: "#121a15", fg: "#e2ebdf", accent: "#7bd88f" }, light: { bg: "#f3f7f0", fg: "#1b261d", accent: "#23763e" } },
	{ id: "ocean", name: "Ocean", emoji: "🌊", description: "Deep water with a teal current.",
		dark: { bg: "#0b1b29", fg: "#dfe9f2", accent: "#3fc1c9" }, light: { bg: "#eff7fa", fg: "#10283a", accent: "#126f7b" } },
	{ id: "synthwave", name: "Synthwave", emoji: "🌆", description: "Hot-pink neon on a purple horizon.",
		dark: { bg: "#1a1025", fg: "#f6e8ff", accent: "#ff4fd8" }, light: { bg: "#fff5fb", fg: "#2a1530", accent: "#c8238f" } },
	{ id: "sakura", name: "Sakura", emoji: "🌸", description: "Cherry blossom pinks.",
		dark: { bg: "#1c1418", fg: "#f7e6ee", accent: "#ff8fb1" }, light: { bg: "#fff6f9", fg: "#3a1f2b", accent: "#c2355f" } },
	{ id: "arc-reactor", name: "Arc Reactor", emoji: "🛡️", description: "Heads-up-display cyan on gunmetal.",
		dark: { bg: "#071318", fg: "#d9f6ff", accent: "#2ee6ff" }, light: { bg: "#f1fafc", fg: "#0b2730", accent: "#00728a" } },
	{ id: "espresso", name: "Espresso", emoji: "☕", description: "Roasted browns and caramel.",
		dark: { bg: "#1e1915", fg: "#eadbc8", accent: "#d39b62" }, light: { bg: "#f8f1e9", fg: "#3b2c22", accent: "#8b5a2b" } },
	{ id: "paper", name: "Paper", emoji: "📜", description: "Warm sepia, easy on the eyes for long reads.",
		dark: { bg: "#1f1b16", fg: "#ece3d0", accent: "#e08a5a" }, light: { bg: "#f7f1e3", fg: "#2b2620", accent: "#a14824" } },
	{ id: "amoled", name: "AMOLED", emoji: "🖤", description: "True black for OLED screens.",
		dark: { bg: "#000000", fg: "#ededed", accent: "#5b93ff" }, light: { bg: "#ffffff", fg: "#0f1115", accent: "#2f63d8" } },
	{ id: "high-contrast", name: "High Contrast", emoji: "🔳", description: "Maximum contrast: pure black and white with a bold accent and strong focus outlines.",
		dark: { bg: "#000000", fg: "#ffffff", accent: "#ffd400" }, light: { bg: "#ffffff", fg: "#000000", accent: "#0033cc" } },
];

export function presetById(id) {
	return PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * A "look" is a whole outfit applied in one click: a theme plus the style
 * settings that make it sing. Patches go through the normal merge + sanitise.
 */
export const LOOKS = [
	{
		id: "liquid-glass-desktop",
		name: "Liquid Glass desktop",
		description: "Liquid Glass theme, frosted glass panels, your desktop wallpaper behind them, rounder corners.",
		patch: {
			theme: { active: "liquid-glass", tint: 0.6 },
			style: { material: "glass", glassBlur: 28, glassOpacity: 42, glassSheen: true, radius: "soft", accentBubbles: true, accentSelection: true, ambience: "none" },
			wallpaper: { src: "desktop", strength: 62, blur: 14 },
		},
	},
];

/** The theme the state selects: a preset, a custom theme, or null for the stock DeepSeek palette. */
export function resolveTheme(state) {
	const active = state?.theme?.active ?? "default";
	if (active.startsWith("custom:")) {
		const id = active.slice(7);
		return state.customThemes?.find((t) => t.id === id) ?? null;
	}
	return presetById(active);
}

const ADJECTIVES = ["Velvet", "Neon", "Quiet", "Electric", "Lunar", "Copper", "Frosted", "Molten", "Hidden", "Golden", "Static", "Wild"];
const NOUNS = ["Comet", "Harbour", "Lagoon", "Circuit", "Orchard", "Ember", "Glacier", "Signal", "Meadow", "Nebula", "Canyon", "Arcade"];

/** A random but harmonious theme: tinted neutrals on one hue, accent on a contrasting hue. */
export function randomTheme(rand = Math.random) {
	const hue = Math.floor(rand() * 360);
	const accentHue = (hue + 90 + Math.floor(rand() * 180)) % 360;
	const tintC = 0.015 + rand() * 0.03;
	const name = `${ADJECTIVES[Math.floor(rand() * ADJECTIVES.length)]} ${NOUNS[Math.floor(rand() * NOUNS.length)]}`;
	return {
		id: "surprise",
		name,
		dark: {
			bg: oklchToHex({ l: 0.17 + rand() * 0.05, c: tintC, h: hue }),
			fg: oklchToHex({ l: 0.94, c: 0.012, h: hue }),
			accent: oklchToHex({ l: 0.76, c: 0.15, h: accentHue }),
		},
		light: {
			bg: oklchToHex({ l: 0.985, c: 0.008, h: hue }),
			fg: oklchToHex({ l: 0.24, c: 0.03, h: hue }),
			accent: oklchToHex({ l: 0.55, c: 0.17, h: accentHue }),
		},
	};
}
//#endregion

//#region style options
export const UI_FONTS = [
	{ id: "default", label: "Harness default", stack: null },
	{ id: "segoe", label: "Segoe UI Variable", stack: '"Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif' },
	{ id: "inter", label: "Inter", stack: 'Inter, "Inter Variable", "Segoe UI", system-ui, sans-serif' },
	{ id: "montserrat", label: "Montserrat (bundled)", stack: '"Montserrat", "Segoe UI", system-ui, sans-serif' },
	{ id: "rounded", label: "Rounded", stack: '"Nunito", "Varela Round", "Arial Rounded MT Bold", "SF Pro Rounded", "Segoe UI", system-ui, sans-serif' },
	{ id: "humanist", label: "Humanist", stack: '"Gill Sans Nova", "Gill Sans", Seravek, Calibri, "Trebuchet MS", sans-serif' },
	{ id: "serif", label: "Bookish serif", stack: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif' },
	{ id: "mono", label: "Monospace everywhere", stack: '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace' },
	// Dyslexia-friendly: OpenDyslexic / Atkinson Hyperlegible / Lexend when installed, else wide, plain sans faces; extra spacing in buildCss.
	{ id: "readable", label: "Easy reading", stack: '"OpenDyslexic", "Atkinson Hyperlegible", "Lexend", Verdana, Tahoma, sans-serif' },
	{ id: "custom", label: "Custom…", stack: null },
	{ id: "folder", label: "From a font folder…", stack: '"Studio Local Font", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif' },
];

/** Family name the host's served font files are registered under. */
export const LOCAL_FONT_FAMILY = "Studio Local Font";

export const MATERIALS = [
	{ id: "solid", label: "Solid" },
	{ id: "glass", label: "Liquid glass" },
];

/**
 * Surfaces that become glass. The browser half finds every stock rule whose
 * background is exactly one of these tokens and gives it the blur + sheen.
 * Menus are left out on purpose: they already blur via --dsw-menu-backdrop-filter.
 */
export const GLASS_TOKENS = [
	"--dsw-specific-sidebar-fill",
	"--dsw-alias-bg-layer-1",
	"--dsw-alias-bg-layer-2",
	"--dsw-alias-bg-layer-3",
	"--dsw-alias-settings-card-fill",
	"--dsw-specific-input-major",
	"--dsw-specific-bubble",
];

export const CODE_FONTS = [
	{ id: "default", label: "Harness default", stack: null },
	{ id: "cascadia", label: "Cascadia Code", stack: '"Cascadia Code", "Cascadia Mono", Consolas, monospace' },
	{ id: "jetbrains", label: "JetBrains Mono", stack: '"JetBrains Mono", Consolas, monospace' },
	{ id: "fira", label: "Fira Code", stack: '"Fira Code", Consolas, monospace' },
	{ id: "consolas", label: "Consolas", stack: 'Consolas, "Courier New", monospace' },
	{ id: "custom", label: "Custom…", stack: null },
];

export const RADII = [
	{ id: "sharp", label: "Sharp", scale: 0.3 },
	{ id: "default", label: "Default", scale: 1 },
	{ id: "soft", label: "Soft", scale: 1.3 },
	{ id: "round", label: "Bubbly", scale: 1.7 },
];
const RADIUS_BASE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, panel: 28 };

export const AMBIENCES = [
	{ id: "none", label: "None" },
	{ id: "aurora", label: "Aurora glow" },
	{ id: "vignette", label: "Vignette" },
	{ id: "grain", label: "Film grain" },
	{ id: "scanlines", label: "CRT scanlines" },
];

export const RESPONSE_STYLES = [
	{ id: "default", label: "Harness default", text: "" },
	{ id: "concise", label: "Concise", text: "Keep replies tight: lead with the answer, skip preamble and filler, and prefer short paragraphs or bullet points." },
	{ id: "thorough", label: "Thorough", text: "Be thorough: explain the reasoning, call out edge cases and trade-offs, and include examples where they help." },
	{ id: "friendly", label: "Friendly", text: "Be warm and conversational, with a little humour where it fits, but never at the expense of accuracy." },
	{ id: "mentor", label: "Mentor", text: "Teach as you go: explain why each step works, name the underlying concept, and point out what is worth learning from it." },
	{ id: "butler", label: "Butler (dry wit)", text: "Adopt the manner of a calm, impeccably polite AI butler with a dry wit: efficient, understated, occasionally wry." },
	{ id: "hype", label: "Hype", text: "Be upbeat and energetic: celebrate progress, keep momentum high, and keep explanations punchy." },
];
//#endregion

export const SOUNDS = [
	{ id: "chime", label: "Chime" },
	{ id: "glass", label: "Glass" },
	{ id: "pop", label: "Soft pop" },
	{ id: "none", label: "No sound" },
];

export const CHAT_WIDTHS = [
	{ id: "default", value: null },
	{ id: "narrow", value: "640px" },
	{ id: "comfortable", value: "820px" },
	{ id: "wide", value: "1100px" },
	{ id: "full", value: "calc(100% - 64px)" },
];

export const CURRENCIES = [
	{ id: "USD", symbol: "$" }, { id: "EUR", symbol: "€" }, { id: "GBP", symbol: "£" }, { id: "CNY", symbol: "¥" },
	{ id: "JPY", symbol: "¥" }, { id: "INR", symbol: "₹" }, { id: "BRL", symbol: "R$" }, { id: "KRW", symbol: "₩" },
];

/** Interface languages. `dir` is set on the Studio page for right-to-left scripts. */
export const LANGUAGES = [
	{ code: "en", name: "English" },
	{ code: "zh-CN", name: "简体中文" },
	{ code: "zh-TW", name: "繁體中文" },
	{ code: "ja", name: "日本語" },
	{ code: "ko", name: "한국어" },
	{ code: "es", name: "Español" },
	{ code: "fr", name: "Français" },
	{ code: "de", name: "Deutsch" },
	{ code: "pt-BR", name: "Português (Brasil)" },
	{ code: "it", name: "Italiano" },
	{ code: "ru", name: "Русский" },
	{ code: "uk", name: "Українська" },
	{ code: "pl", name: "Polski" },
	{ code: "nl", name: "Nederlands" },
	{ code: "tr", name: "Türkçe" },
	{ code: "vi", name: "Tiếng Việt" },
	{ code: "id", name: "Bahasa Indonesia" },
	{ code: "hi", name: "हिन्दी" },
	{ code: "ar", name: "العربية", dir: "rtl" },
];

/** Pick the best supported language for a list of BCP 47 tags (e.g. navigator.languages). */
export function matchLanguage(tags) {
	for (const tag of tags ?? []) {
		const t = String(tag).toLowerCase();
		const exact = LANGUAGES.find((l) => l.code.toLowerCase() === t);
		if (exact) return exact.code;
		if (t.startsWith("zh")) return /tw|hk|mo|hant/.test(t) ? "zh-TW" : "zh-CN";
		if (t.startsWith("pt")) return "pt-BR";
		const base = LANGUAGES.find((l) => l.code.toLowerCase() === t.split("-")[0]);
		if (base) return base.code;
	}
	return "en";
}

function cleanPrices(raw) {
	const out = {};
	if (!raw || typeof raw !== "object") return out;
	for (const [model, p] of Object.entries(raw).slice(0, 100)) {
		if (typeof model !== "string" || !model || model.length > 120 || !p || typeof p !== "object") continue;
		const price = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 10_000 ? v : null);
		out[model] = { input: price(p.input), output: price(p.output), cacheRead: price(p.cacheRead) };
	}
	return out;
}
//#endregion

//#region image → theme, accents
/** The harness's own palette, as a theme object (used when no theme is selected). */
export const STOCK_THEME = {
	id: "default", name: "DeepSeek",
	dark: { bg: "#151517", fg: "#f9fafb", accent: "#7aaaff" },
	light: { bg: "#ffffff", fg: "#0f1115", accent: "#4176e6" },
};

function labDistance(a, b) {
	return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/** k-means in OKLab with a deterministic lightness-spread start. Returns clusters sorted by size. */
function kmeans(points, k) {
	if (!points.length) return [];
	const n = Math.min(k, points.length);
	const sorted = [...points].sort((a, b) => a[0] - b[0] || Math.hypot(a[1], a[2]) - Math.hypot(b[1], b[2]));
	let centers = Array.from({ length: n }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / n)].slice());
	const assign = new Int32Array(points.length);
	for (let iter = 0; iter < 14; iter++) {
		for (let p = 0; p < points.length; p++) {
			let best = 0;
			let bestD = Infinity;
			for (let c = 0; c < centers.length; c++) {
				const d = labDistance(points[p], centers[c]);
				if (d < bestD) { bestD = d; best = c; }
			}
			assign[p] = best;
		}
		const sums = centers.map(() => [0, 0, 0, 0]);
		for (let p = 0; p < points.length; p++) {
			const s = sums[assign[p]];
			s[0] += points[p][0]; s[1] += points[p][1]; s[2] += points[p][2]; s[3]++;
		}
		centers = centers.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
	}
	const counts = new Array(centers.length).fill(0);
	for (const a of assign) counts[a]++;
	return centers
		.map((lab, i) => {
			let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
			if (h < 0) h += 360;
			return { hex: toHex(oklabToLinear(lab).map((v) => fromLinear(clamp01(v)))), l: lab[0], c: Math.hypot(lab[1], lab[2]), h, weight: counts[i] / points.length };
		})
		.filter((x) => x.weight > 0)
		.sort((a, b) => b.weight - a.weight);
}

/**
 * Colours of an image: `dominant` (what most of it is) and `vivid` (its
 * stand-out colours, clustered separately so a small bright detail on a dark
 * wallpaper still becomes the accent).
 * @param data RGBA bytes, e.g. ImageData.data of a downscaled image
 */
export function extractPalette(data) {
	const all = [];
	const vivid = [];
	for (let o = 0; o + 3 < data.length; o += 4) {
		if (data[o + 3] < 128) continue;
		const lab = linearToOklab([data[o], data[o + 1], data[o + 2]].map((v) => toLinear(v / 255)));
		all.push(lab);
		if (Math.hypot(lab[1], lab[2]) > 0.07 && lab[0] > 0.3) vivid.push(lab);
	}
	return { dominant: kmeans(all, 5), vivid: vivid.length >= 8 ? kmeans(vivid, 4) : [] };
}

function hueDistance(a, b) {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

/** Nudge an accent's lightness until it reads against the background (≥ `min` contrast). */
export function fitAccent(color, bg, mode, min = 4.5) {
	const lch = typeof color === "string" ? hexToOklch(color) : color;
	const c = Math.max(0.1, Math.min(0.22, lch.c ?? 0.14));
	let l = mode === "dark" ? Math.max(0.66, Math.min(0.86, lch.l ?? 0.74)) : Math.min(0.6, Math.max(0.36, lch.l ?? 0.52));
	for (let i = 0; i < 40 && contrast(oklchToHex({ l, c, h: lch.h }), bg) < min; i++) l += mode === "dark" ? 0.01 : -0.01;
	return oklchToHex({ l: clamp01(l), c, h: lch.h });
}

/** Build a readable light + dark theme from an image palette (see extractPalette). */
export function themeFromPalette(palette, name = "From image") {
	const base = palette.dominant[0] ?? { h: 260, c: 0.02, l: 0.2 };
	const accents = palette.vivid.length ? palette.vivid : palette.dominant.filter((x) => x.c > 0.05);
	const a1 = [...accents].sort((x, y) => y.c * Math.sqrt(y.weight) - x.c * Math.sqrt(x.weight))[0] ?? { h: (base.h + 200) % 360, c: 0.14, l: 0.7 };
	const a2 = accents.find((x) => hueDistance(x.h, a1.h) > 40) ?? { h: (a1.h + 305) % 360, c: a1.c, l: a1.l };
	const hue = base.c > 0.02 ? base.h : a1.h;
	const tint = Math.min(0.035, Math.max(0.008, base.c * 0.5));
	const dark = { bg: oklchToHex({ l: 0.16, c: tint, h: hue }), fg: oklchToHex({ l: 0.95, c: 0.012, h: hue }) };
	const light = { bg: oklchToHex({ l: 0.975, c: Math.min(0.012, tint * 0.6), h: hue }), fg: oklchToHex({ l: 0.22, c: Math.min(0.03, tint), h: hue }) };
	return {
		name,
		dark: { ...dark, accent: fitAccent(a1, dark.bg, "dark"), accent2: fitAccent(a2, dark.bg, "dark", 3) },
		light: { ...light, accent: fitAccent(a1, light.bg, "light"), accent2: fitAccent(a2, light.bg, "light", 3) },
	};
}

/** The same theme with another accent colour, fitted for contrast in each mode. */
export function withAccent(theme, accentHex) {
	return {
		...theme,
		dark: { ...theme.dark, accent: fitAccent(accentHex, theme.dark.bg, "dark") },
		light: { ...theme.light, accent: fitAccent(accentHex, theme.light.bg, "light") },
	};
}
//#endregion

//#region theme building tools (the theme editor's generators and adjusters)
/** Minimum contrast against the background the editor asks for, per colour. */
export const EDITOR_MINIMUMS = { fg: 7, accent: 3, accent2: 3 };

/** Seeded random numbers (mulberry32): the same seed always gives the same sequence. */
export function seededRandom(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A stable number for any text (FNV-1a over code points), so a word always makes the same theme. */
export function hashText(text) {
	let h = 0x811c9dc5;
	for (const ch of String(text ?? "").normalize("NFC").trim().toLowerCase()) {
		h ^= ch.codePointAt(0);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/** The colour itself when it already reads against `bg`, otherwise its lightness moved just far enough. */
export function ensureContrast(hex, bg, min, mode) {
	const color = normHex(hex);
	if (!color) return color;
	if (contrast(color, bg) >= min) return color;
	return withContrastFloor(hexToOklch(color), bg, min, mode);
}

/** Every colour of a theme brought up to the editor's minimums (only the ones that fall short change). */
export function fixContrast(theme, modes = ["dark", "light"]) {
	const out = { ...theme };
	for (const mode of modes) {
		const m = theme[mode];
		out[mode] = { ...m, fg: ensureContrast(m.fg, m.bg, EDITOR_MINIMUMS.fg, mode), accent: ensureContrast(m.accent, m.bg, EDITOR_MINIMUMS.accent, mode) };
		if (m.accent2) out[mode].accent2 = ensureContrast(m.accent2, m.bg, EDITOR_MINIMUMS.accent2, mode);
	}
	return out;
}

const wrapHue = (h) => ((h % 360) + 360) % 360;

/**
 * Both schemes from a few numbers: neutrals tinted with `hue` at `tint` chroma, an accent
 * and a partner accent on their own hues, and `depth` (−1 deeper … 1 lighter dark background).
 * Text and accents are fitted for contrast.
 */
export function composeTheme({ name = "My theme", hue, tint = 0.02, accentHue, accentC = 0.15, accent2Hue, depth = 0 }) {
	const darkBg = oklchToHex({ l: Math.min(0.3, Math.max(0.08, 0.17 + depth * 0.07)), c: tint, h: wrapHue(hue) });
	const lightBg = oklchToHex({ l: 0.982, c: Math.min(0.014, tint * 0.5), h: wrapHue(hue) });
	const accent = (bg, mode, h, min) => ensureContrast(oklchToHex({ l: mode === "dark" ? 0.76 : 0.52, c: accentC, h: wrapHue(h) }), bg, min, mode);
	const mode = (m, bg) => ({
		bg,
		fg: ensureContrast(oklchToHex({ l: m === "dark" ? 0.94 : 0.24, c: Math.min(m === "dark" ? 0.02 : 0.035, tint * (m === "dark" ? 0.6 : 1.2)), h: wrapHue(hue) }), bg, 7.5, m),
		accent: accent(bg, m, accentHue, 4.5),
		accent2: accent(bg, m, accent2Hue ?? accentHue + 40, 3),
	});
	return { name, dark: mode("dark", darkBg), light: mode("light", lightBg) };
}

/** Colour-harmony rules: where the background tint and the second accent sit relative to the picked colour. */
export const HARMONIES = [
	{ id: "mono", bg: 0, accent2: 25, tint: 0.032 },
	{ id: "analogous", bg: -30, accent2: 35, tint: 0.022 },
	{ id: "complementary", bg: 180, accent2: 180, tint: 0.02 },
	{ id: "split", bg: 150, accent2: 210, tint: 0.02 },
	{ id: "triadic", bg: 120, accent2: 240, tint: 0.022 },
];

/** A theme built around one colour (it becomes the accent wherever it reads well enough). */
export function themeFromColor(hex, harmony = "complementary", name = "My colour") {
	const pick = hexToOklch(normHex(hex) ?? "#5b93ff");
	const rule = HARMONIES.find((x) => x.id === harmony) ?? HARMONIES[2];
	const hue = pick.c < 0.02 ? 260 : pick.h;   // a grey pick has no hue of its own; use a cool neutral
	const theme = composeTheme({ name, hue: hue + rule.bg, tint: pick.c < 0.02 ? 0.006 : rule.tint, accentHue: hue, accentC: Math.max(0.1, pick.c), accent2Hue: hue + rule.accent2 });
	const own = normHex(hex);
	for (const mode of ["dark", "light"]) {
		const m = theme[mode];
		if (own && contrast(own, m.bg) >= 4.5) m.accent = own;
	}
	return theme;
}

/** Moods: ranges a theme is drawn from, so every click gives a new take on the same feeling. */
export const MOODS = [
	{ id: "calm", emoji: "🌿", hue: [170, 220], tint: [0.012, 0.022], accent: [160, 210], chroma: [0.1, 0.13], depth: [-0.1, 0.3], spread: 40 },
	{ id: "cozy", emoji: "🕯️", hue: [40, 70], tint: [0.02, 0.035], accent: [45, 75], chroma: [0.12, 0.16], depth: [0, 0.3], spread: -35 },
	{ id: "energetic", emoji: "⚡", hue: [260, 320], tint: [0.02, 0.03], accent: [330, 400], chroma: [0.18, 0.22], depth: [-0.3, 0], spread: 60 },
	{ id: "focus", emoji: "🎯", hue: [240, 270], tint: [0.004, 0.012], accent: [230, 260], chroma: [0.12, 0.15], depth: [-0.3, 0], spread: 25 },
	{ id: "dreamy", emoji: "☁️", hue: [280, 320], tint: [0.02, 0.035], accent: [300, 340], chroma: [0.11, 0.14], depth: [0, 0.4], spread: -60 },
	{ id: "retro", emoji: "📼", hue: [30, 60], tint: [0.025, 0.04], accent: [20, 50], chroma: [0.14, 0.17], depth: [-0.1, 0.2], spread: 150 },
	{ id: "cyber", emoji: "🤖", hue: [250, 290], tint: [0.03, 0.045], accent: [185, 210], chroma: [0.14, 0.17], depth: [-0.4, -0.1], spread: 130 },
	{ id: "nature", emoji: "🌲", hue: [120, 160], tint: [0.02, 0.03], accent: [130, 160], chroma: [0.13, 0.16], depth: [-0.1, 0.2], spread: -60 },
	{ id: "ocean", emoji: "🌊", hue: [220, 250], tint: [0.025, 0.04], accent: [185, 215], chroma: [0.11, 0.14], depth: [-0.2, 0.1], spread: 40 },
	{ id: "sunset", emoji: "🌅", hue: [330, 380], tint: [0.025, 0.04], accent: [40, 70], chroma: [0.15, 0.18], depth: [-0.1, 0.2], spread: -60 },
	{ id: "luxury", emoji: "💎", hue: [270, 300], tint: [0.006, 0.015], accent: [80, 100], chroma: [0.11, 0.13], depth: [-0.4, -0.2], spread: 190 },
	{ id: "playful", emoji: "🎈", hue: [0, 360], tint: [0.02, 0.03], accent: [0, 360], chroma: [0.18, 0.22], depth: [0, 0.3], spread: 150 },
];

/** A fresh theme in a mood (see MOODS); pass a seeded `rand` for a repeatable one. */
export function themeFromMood(id, name = id, rand = Math.random) {
	const mood = MOODS.find((x) => x.id === id) ?? MOODS[0];
	const pickIn = ([lo, hi]) => lo + rand() * (hi - lo);
	const accentHue = pickIn(mood.accent);
	return composeTheme({
		name, hue: pickIn(mood.hue), tint: pickIn(mood.tint), accentHue, accentC: pickIn(mood.chroma),
		accent2Hue: accentHue + mood.spread * (0.8 + rand() * 0.4), depth: pickIn(mood.depth),
	});
}

/** The theme a word, a name or any text makes: always the same one for the same text. */
export function themeFromWord(text) {
	const word = String(text ?? "").trim().slice(0, 40);
	const theme = randomTheme(seededRandom(hashText(word)));
	return { ...theme, id: undefined, name: word ? word[0].toUpperCase() + word.slice(1) : theme.name };
}

/**
 * The whole theme shifted at once: `hue` (degrees), `vivid` (chroma ×), `warmth` (−1 cool … 1
 * warm) and `depth` (−1 darker … 1 lighter backgrounds). Text and accents keep their contrast.
 */
export function adjustTheme(theme, { hue = 0, vivid = 1, warmth = 0, depth = 0 } = {}) {
	const out = { ...theme };
	for (const mode of ["dark", "light"]) {
		const m = theme[mode];
		const shift = (hex, role) => {
			const c = hexToOklch(hex);
			let h = wrapHue(c.h + hue);
			let chroma = c.c * vivid;
			let l = c.l;
			const neutral = role === "bg" || role === "fg";
			if (warmth) {
				const target = warmth > 0 ? 65 : 250;
				const w = Math.min(1, Math.abs(warmth));
				if (neutral) {
					h = c.c < 0.006 ? target : lerpHue(h, target, w * 0.8);
					chroma += w * (role === "bg" ? (mode === "dark" ? 0.022 : 0.012) : 0.01);
				} else h = lerpHue(h, warmth > 0 ? 50 : 240, w * 0.25);
			}
			if (role === "bg" && depth) l = mode === "dark" ? Math.min(0.32, Math.max(0.04, l + depth * 0.08)) : Math.min(1, Math.max(0.86, l + depth * 0.03));
			return oklchToHex({ l, c: Math.max(0, Math.min(neutral ? 0.08 : 0.3, chroma)), h });
		};
		out[mode] = { bg: shift(m.bg, "bg"), fg: shift(m.fg, "fg"), accent: shift(m.accent, "accent") };
		if (m.accent2) out[mode].accent2 = shift(m.accent2, "accent2");
	}
	return fixContrast(out);
}

/** One scheme rebuilt from the other: same hues, the lightness that suits the target mode. */
export function mirrorMode(theme, from = "dark") {
	const to = from === "dark" ? "light" : "dark";
	const s = theme[from];
	const bg = hexToOklch(s.bg);
	const fg = hexToOklch(s.fg);
	const hue = bg.c > 0.006 ? bg.h : fg.h;
	const tint = bg.c;
	const newBg = to === "light"
		? oklchToHex({ l: 0.978, c: Math.min(0.016, tint * 0.6), h: hue })
		: oklchToHex({ l: 0.17, c: Math.min(0.045, Math.max(tint * 1.6, fg.c)), h: hue });
	const newFg = to === "light"
		? oklchToHex({ l: 0.23, c: Math.min(0.035, Math.max(fg.c, tint)), h: fg.c > 0.006 ? fg.h : hue })
		: oklchToHex({ l: 0.94, c: Math.min(0.02, fg.c), h: fg.c > 0.006 ? fg.h : hue });
	const m = { bg: newBg, fg: ensureContrast(newFg, newBg, 7.5, to), accent: fitAccent(s.accent, newBg, to) };
	if (s.accent2) m.accent2 = fitAccent(s.accent2, newBg, to, 3);
	return { ...theme, [to]: m };
}

/** Accent and second accent swapped (an auto second accent becomes a complementary one). */
export function swapAccents(theme) {
	const out = { ...theme };
	for (const mode of ["dark", "light"]) {
		const m = theme[mode];
		const a = hexToOklch(m.accent);
		const second = m.accent2 ?? oklchToHex({ l: a.l, c: Math.max(0.1, a.c), h: wrapHue(a.h + 180) });
		out[mode] = { ...m, accent: second, accent2: m.accent };
	}
	return fixContrast(out);
}

/** Ready-made twists on a theme, for the editor's Variations row. */
export function themeVariations(theme) {
	return [
		{ id: "hueUp", theme: adjustTheme(theme, { hue: 35 }) },
		{ id: "hueDown", theme: adjustTheme(theme, { hue: -35 }) },
		{ id: "vivid", theme: adjustTheme(theme, { vivid: 1.6 }) },
		{ id: "soft", theme: adjustTheme(theme, { vivid: 0.45 }) },
		{ id: "warm", theme: adjustTheme(theme, { warmth: 0.6 }) },
		{ id: "cool", theme: adjustTheme(theme, { warmth: -0.6 }) },
		{ id: "deep", theme: adjustTheme(theme, { depth: -0.9 }) },
		{ id: "swap", theme: swapAccents(theme) },
	];
}
//#endregion

//#region sun times, schedule, prompts, usage

const pad2 = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Sunrise and sunset for the local calendar day of `date` at a location (NOAA
 * approximation, about a minute's accuracy). Returns null times inside polar
 * day or night.
 */
export function sunTimes(date, lat, lon) {
	const rad = Math.PI / 180;
	const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const dayOfYear = Math.round((utcMidnight - Date.UTC(date.getFullYear(), 0, 0)) / 86_400_000);
	const g = ((2 * Math.PI) / 365) * (dayOfYear - 0.5);
	const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
	const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
	const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
	if (cosH > 1) return { sunrise: null, sunset: null, polar: "night" };
	if (cosH < -1) return { sunrise: null, sunset: null, polar: "day" };
	const ha = Math.acos(cosH) / rad;
	const at = (minutes) => new Date(utcMidnight + minutes * 60_000);
	return { sunrise: at(720 - 4 * (lon + ha) - eqtime), sunset: at(720 - 4 * (lon - ha) - eqtime), polar: null };
}

/** Fallback times for sunrise/sunset entries when no location is set (or in polar day/night). */
export const SUN_FALLBACK = { sunrise: "07:00", sunset: "19:00" };

/** "HH:MM" for an entry's time on a given day: fixed, or the day's sunrise/sunset at `location`. */
export function resolveEntryTime(time, day, location) {
	if (time !== "sunrise" && time !== "sunset") return time;
	if (location?.lat == null || location?.lon == null) return SUN_FALLBACK[time];
	const when = sunTimes(day, location.lat, location.lon)[time];
	return when ? `${pad2(when.getHours())}:${pad2(when.getMinutes())}` : SUN_FALLBACK[time];
}

/**
 * The schedule entry in force at `now`: the latest one whose time has passed
 * today, else yesterday's last one. Entries may be "HH:MM", "sunrise" or
 * "sunset". `key` changes exactly when a new slot starts, so the browser
 * applies each slot once and leaves manual changes alone.
 */
export function scheduleSlot(entries, now = new Date(), location = null) {
	if (!entries.length) return null;
	const resolved = (day) => entries.map((e) => ({ entry: e, at: resolveEntryTime(e.time, day, location) })).sort((a, b) => a.at.localeCompare(b.at));
	const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
	let hit = [...resolved(now)].reverse().find((x) => x.at <= hhmm);
	const day = new Date(now);
	if (!hit) {
		day.setDate(day.getDate() - 1);
		const yesterday = resolved(day);
		hit = yesterday[yesterday.length - 1];
	}
	return { entry: hit.entry, at: hit.at, key: `${dayKey(day)}@${hit.entry.time}#${hit.entry.target}` };
}

const PLACEHOLDER = /\{(clipboard|date|time|day|ask(?::([^{}\n]{1,60}))?)\}/g;

/** What a saved prompt needs filled in: the clipboard and/or labelled answers. */
export function promptPlaceholders(text) {
	const asks = [];
	let clipboard = false;
	for (const m of String(text).matchAll(PLACEHOLDER)) {
		if (m[1] === "clipboard") clipboard = true;
		else if (m[1].startsWith("ask")) {
			const label = (m[2] ?? "").trim() || "Answer";
			if (!asks.includes(label)) asks.push(label);
		}
	}
	return { clipboard, asks };
}

/** Replace {clipboard} {date} {time} {day} {ask:Label} in a prompt. */
export function fillPrompt(text, { clipboard = "", answers = {}, now = new Date(), locale } = {}) {
	return String(text).replace(PLACEHOLDER, (_, kind, label) => {
		if (kind === "clipboard") return clipboard;
		if (kind === "date") return now.toLocaleDateString(locale);
		if (kind === "time") return now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
		if (kind === "day") return now.toLocaleDateString(locale, { weekday: "long" });
		return answers[(label ?? "").trim() || "Answer"] ?? "";
	});
}

/**
 * Totals for usage records { t, m, a (uncached input), o (output), r (cache read), w (cache write) }.
 * Prices are per model, USD per million tokens; cache writes are billed as input.
 */
export function usageSummary(records, prices = {}, now = new Date()) {
	const bucket = () => ({ calls: 0, input: 0, output: 0, cached: 0, tokens: 0, cost: 0, priced: true });
	const add = (b, r) => {
		const input = (r.a | 0) + (r.w | 0);
		b.calls++;
		b.input += input;
		b.output += r.o | 0;
		b.cached += r.r | 0;
		b.tokens += input + (r.o | 0) + (r.r | 0);
		const cost = recordCost(r, prices);
		if (cost === null) b.priced = false;
		else b.cost += cost;
	};
	const today = new Date(now); today.setHours(0, 0, 0, 0);
	// Rolling windows (today plus the 6 / 29 days before), matching the 30-day chart.
	const week = new Date(today); week.setDate(week.getDate() - 6);
	const month = new Date(today); month.setDate(month.getDate() - 29);
	const out = { today: bucket(), week: bucket(), month: bucket(), all: bucket(), models: {}, days: [] };
	const days = new Map();
	for (let i = 29; i >= 0; i--) {
		const d = new Date(today); d.setDate(d.getDate() - i);
		days.set(dayKey(d), { day: dayKey(d), ...bucket() });
	}
	for (const r of records) {
		add(out.all, r);
		if (r.t >= month.getTime()) add(out.month, r);
		if (r.t >= week.getTime()) add(out.week, r);
		if (r.t >= today.getTime()) add(out.today, r);
		add((out.models[r.m] ??= bucket()), r);
		const day = days.get(dayKey(new Date(r.t)));
		if (day) add(day, r);
	}
	out.days = [...days.values()];
	return out;
}

/** USD cost of one usage record, or null when the model has no price set. */
export function recordCost(r, prices) {
	const p = prices?.[r.m];
	if (!p || p.input == null || p.output == null) return null;
	return (((r.a | 0) + (r.w | 0)) * p.input + (r.o | 0) * p.output + (r.r | 0) * (p.cacheRead ?? p.input)) / 1e6;
}

/**
 * Spend against the daily and monthly budgets (USD). Days and months are
 * calendar ones in local time; calls to unpriced models count as unknown.
 * `level` is "off" (no limit), "ok", "warn" (past warnAt %) or "over".
 */
export function budgetStatus(records, prices, budget, now = new Date()) {
	const today = new Date(now); today.setHours(0, 0, 0, 0);
	const month = new Date(now.getFullYear(), now.getMonth(), 1);
	let day = 0;
	let monthly = 0;
	let unpriced = 0;
	for (const r of records) {
		if (r.t < month.getTime() && r.t < today.getTime()) continue;
		const cost = recordCost(r, prices);
		if (cost === null) { unpriced++; continue; }
		if (r.t >= month.getTime()) monthly += cost;
		if (r.t >= today.getTime()) day += cost;
	}
	const warn = (budget?.warnAt ?? 80) / 100;
	const status = (spent, limit, period) => ({
		spent, limit, period,
		ratio: limit ? spent / limit : 0,
		level: limit == null ? "off" : spent >= limit ? "over" : spent >= limit * warn ? "warn" : "ok",
	});
	return {
		daily: status(day, budget?.daily ?? null, dayKey(today)),
		monthly: status(monthly, budget?.monthly ?? null, `${month.getFullYear()}-${pad2(month.getMonth() + 1)}`),
		unpriced,
	};
}

/** A community prompt pack from the gallery, or null if it isn't valid. */
export function cleanGalleryPack(p) {
	const id = safeId(p?.id);
	if (!id || !Array.isArray(p.prompts)) return null;
	const prompts = p.prompts
		.filter((x) => typeof x?.text === "string" && x.text.trim())
		.slice(0, 50)
		.map((x) => ({ title: str(x.title, "Untitled", LIMITS.short) || "Untitled", text: x.text.slice(0, LIMITS.prompt), folder: str(x.folder, "", 40).trim() }));
	if (!prompts.length) return null;
	return {
		id,
		name: str(p.name, id, 40) || id,
		emoji: str(p.emoji, "✦", 8) || "✦",
		author: str(p.author, "", 40),
		description: str(p.description, "", 160),
		prompts,
	};
}

/**
 * The settings as they look with a schedule/workspace target applied —
 * "theme:<id>", "look:<id>" (a saved look) or "builtin:<id>" — without saving
 * anything. Unknown targets leave the state as it is.
 */
/**
 * The theme or look a workspace shows while it is open ("" for none). High
 * Contrast is an accessibility choice, so while it is on it wins everywhere.
 */
export function workspaceTarget(state, workspaceId) {
	if (state.theme?.active === "high-contrast") return "";
	return state.workspaceThemes?.[workspaceId] ?? "";
}

export function applyTargetToState(state, target) {
	if (typeof target !== "string") return state;
	const [kind, ...rest] = target.split(":");
	const id = rest.join(":");
	if (kind === "theme") return { ...state, theme: { ...state.theme, active: id } };
	if (kind === "look") {
		const look = state.looks.find((l) => l.id === id);
		return look ? { ...state, theme: look.theme, style: look.style, wallpaper: look.wallpaper } : state;
	}
	if (kind === "builtin") {
		const look = LOOKS.find((l) => l.id === id);
		return look ? sanitizeState(mergePatch(state, look.patch)) : state;
	}
	return state;
}

//#region chat export
const blockText = (content, type) => (Array.isArray(content) ? content : []).filter((b) => b?.type === type && typeof b.text === "string").map((b) => b.text).join("\n\n");

/**
 * A readable transcript from a Session's events: what the person typed and
 * what the assistant answered, with the tools it used. System, developer and
 * tool-result records are left out.
 */
export function transcriptFromEvents(events) {
	const messages = [];
	for (const e of events ?? []) {
		if (e?.type === "user/message") {
			const message = e.data?.message ?? e.data;
			if (message?.source && message.source.kind !== "user") continue;
			const text = blockText(message?.content, "text").trim();
			if (text) messages.push({ role: "user", text, tools: [], time: e.time ?? null });
		} else if (e?.type === "assistant/message") {
			const content = e.data?.message?.content;
			const text = blockText(content, "text").trim();
			const tools = (Array.isArray(content) ? content : []).filter((b) => b?.type === "tool-call" && typeof b.name === "string").map((b) => b.name);
			const last = messages[messages.length - 1];
			// One turn can take several model steps (text, tool calls, more text): show it as one reply.
			if (last?.role === "assistant" && !last.closed) {
				if (text) last.text = last.text ? `${last.text}\n\n${text}` : text;
				last.tools.push(...tools);
			} else if (text || tools.length) {
				messages.push({ role: "assistant", text, tools, time: e.time ?? null });
			}
		} else if (e?.type === "turn/end") {
			const last = messages[messages.length - 1];
			if (last?.role === "assistant") last.closed = true;
		}
	}
	return messages.map(({ closed, ...m }) => m);
}

/** Markdown for a transcript. `labels` translates "you", "assistant", "tools" and "exported". */
export function transcriptToMarkdown({ title, messages, exportedAt = new Date(), locale }, labels = {}) {
	const L = { you: "You", assistant: "Assistant", tools: "Tools used", exported: "Exported", ...labels };
	const lines = [`# ${title || "Chat"}`, "", `*${L.exported} ${exportedAt.toLocaleString(locale)}*`, ""];
	for (const m of messages) {
		lines.push(`## ${m.role === "user" ? L.you : L.assistant}`, "");
		if (m.text) lines.push(m.text, "");
		if (m.tools?.length) lines.push(`> ${L.tools}: ${[...new Set(m.tools)].map((n) => "`" + n + "`").join(", ")}`, "");
	}
	return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineMarkdown(text) {
	const codes = [];
	let s = escapeHtml(text).replace(/`([^`\n]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
	s = s
		.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>')
		.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
		.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
		.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>")
		.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
	return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

/**
 * Markdown → HTML for printing a transcript. Escapes everything first, then
 * adds structure (headings, code blocks, lists, quotes, tables, links), so
 * nothing in a chat can inject markup or script.
 */
export function markdownToHtml(md) {
	const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
	const out = [];
	let i = 0;
	const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
	const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inlineMarkdown(c.trim()));
	while (i < lines.length) {
		const line = lines[i];
		const fence = /^\s*(```|~~~)\s*([\w+-]*)/.exec(line);
		if (fence) {
			const body = [];
			for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i]);
			i++;
			out.push(`<pre><code${fence[2] ? ` class="language-${escapeHtml(fence[2])}"` : ""}>${escapeHtml(body.join("\n"))}</code></pre>`);
			continue;
		}
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading) { out.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`); i++; continue; }
		if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
		if (/^\s*>/.test(line)) {
			const body = [];
			for (; i < lines.length && /^\s*>/.test(lines[i]); i++) body.push(lines[i].replace(/^\s*>\s?/, ""));
			out.push(`<blockquote>${markdownToHtml(body.join("\n"))}</blockquote>`);
			continue;
		}
		if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
			const head = cells(line);
			const rows = [];
			for (i += 2; i < lines.length && lines[i].includes("|") && lines[i].trim(); i++) rows.push(cells(lines[i]));
			out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
			continue;
		}
		const list = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
		if (list) {
			const ordered = /\d/.test(list[1]);
			const items = [];
			for (; i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]); i++) items.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ""))}</li>`);
			out.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
			continue;
		}
		if (!line.trim()) { i++; continue; }
		const para = [];
		for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*(```|~~~|>|[-*+]\s|\d+[.)]\s))/.test(lines[i]); i++) para.push(lines[i]);
		if (!para.length) { para.push(lines[i]); i++; }
		out.push(`<p>${para.map(inlineMarkdown).join("<br>")}</p>`);
	}
	return out.join("\n");
}
//#endregion

//#region translatable host messages
/**
 * An error the browser half can show in the person's language: `code` names a
 * "host.<code>" string, `params` fills it (a param may itself be a message),
 * and the English text is the fallback.
 */
export class StudioError extends Error {
	constructor(code, params = {}, text = code) {
		super(text);
		this.code = code;
		this.params = params;
	}
}

/** Any thrown value as a plain { code, params, text } message the browser can translate. */
export function hostMessage(error) {
	if (error && typeof error === "object" && !(error instanceof Error) && typeof error.code === "string") return error;
	if (error instanceof StudioError) {
		const params = {};
		for (const [k, v] of Object.entries(error.params ?? {})) params[k] = v instanceof Error ? hostMessage(v) : v;
		return { code: error.code, params, text: error.message };
	}
	if (error?.name === "AbortError" || error?.name === "TimeoutError") return { code: "timeout", params: {}, text: "it took too long to answer" };
	const text = String(error?.message ?? error);
	return { code: "raw", params: { text }, text };
}
//#endregion

/** A community theme from the gallery, or null if it isn't valid. */
export function cleanGalleryTheme(t) {
	const id = safeId(t?.id);
	const modes = cleanThemeModes(t);
	if (!id || !modes) return null;
	return {
		id,
		name: str(t.name, id, 40) || id,
		emoji: str(t.emoji, "🎨", 8) || "🎨",
		author: str(t.author, "", 40),
		description: str(t.description, "", 160),
		...modes,
	};
}
//#endregion

//#region state
const DEFAULT_PROMPTS = [
	{ id: "p_explain", title: "Explain like I'm new", text: "Explain the following step by step, assuming I'm new to it. Define any jargon the first time it appears:\n\n" },
	{ id: "p_review", title: "Review for bugs", text: "Review this code for bugs, edge cases, and security issues. For each finding give the location, why it's a problem, and a fix:\n\n" },
	{ id: "p_tests", title: "Write tests", text: "Write focused unit tests for the code below. Cover the happy path, edge cases, and failure modes, using the project's existing test framework:\n\n" },
	{ id: "p_refactor", title: "Refactor for readability", text: "Refactor this for readability without changing behaviour. Briefly explain each change:\n\n" },
	{ id: "p_summary", title: "Summarise", text: "Summarise this in five bullet points, then give a one-sentence TL;DR:\n\n" },
	{ id: "p_commit", title: "Commit message", text: "Write a conventional commit message for the staged changes: a subject line of at most 72 characters, a blank line, then a short body explaining why." },
];

/** Starter AI modes: saved sets of style, language and instructions, switched from the AI tab, Ctrl+K or /ai. */
const DEFAULT_MODES = [
	{ id: "m_coding", name: "Coding", emoji: "💻", style: "concise", language: "", instructions: "Work like a senior engineer pairing with me. Show complete, runnable code, point out risks before changing anything, and prefer small steps I can review." },
	{ id: "m_writing", name: "Writing", emoji: "✍️", style: "friendly", language: "", instructions: "Help me write clearly. Keep my voice, cut filler, suggest a stronger structure, and briefly explain notable edits." },
	{ id: "m_simple", name: "Explain simply", emoji: "🧸", style: "mentor", language: "", instructions: "Explain like I'm five: everyday words, short sentences, one idea at a time, and a concrete everyday comparison for every abstract idea." },
	{ id: "m_brainstorm", name: "Brainstorm", emoji: "💡", style: "hype", language: "", instructions: "Brainstorm with me: offer many varied ideas quickly, including bold ones, then help me pick and sharpen the best few." },
];

export function defaultState() {
	return {
		version: 1,
		theme: { active: "default", tint: 1 },
		customThemes: [],
		style: {
			uiFont: "default", uiFontCustom: "", fontDir: "", codeFont: "default", codeFontCustom: "",
			radius: "default", accentBubbles: false, accentSelection: true,
			ambience: "none", ambienceStrength: 40, animate: true,
			material: "solid", glassBlur: 24, glassOpacity: 45, glassSheen: true,
			reduceTransparency: false, focusRings: false,
		},
		/** src: an image (data:/https:), or a sentinel: "desktop", "bing", "folder" (slideshow) or "video". */
		wallpaper: { src: "", strength: 30, blur: 0, folder: "", interval: 30, video: "" },
		identity: {
			name: "", appName: "", mark: "default", markEmoji: "✨", markText: "", markImage: "",
			greeting: false, greetingTemplate: DEFAULT_GREETING, hideBadge: false,
		},
		persona: { enabled: false, aboutMe: "", style: "default", language: "", instructions: "", modes: DEFAULT_MODES.map((m) => ({ ...m })), mode: "" },
		prompts: DEFAULT_PROMPTS.map((p) => ({ ...p, folder: "" })),
		customCss: "",
		updates: { auto: false },
		/** User-saved looks: { id, name, emoji, theme, style, wallpaper }. */
		looks: [],
		/** Time-of-day switching between looks/themes; `applied` remembers the last slot applied. */
		schedule: { enabled: false, entries: [], applied: "", location: { lat: null, lon: null } },
		followWindows: { accent: false },
		alerts: { enabled: false, notify: true, sound: "chime", volume: 60, onlyWhenAway: true, minSeconds: 15, needsInput: true },
		layout: { chatWidth: "default", scale: 100 },
		usage: { currency: "USD", rate: 1, prices: {}, balanceEnv: "DEEPSEEK_API_KEY", budget: { daily: null, monthly: null, warnAt: 80 } },
		/** Workspace id → "theme:…" / "look:…" / "builtin:…" shown while that workspace is open. */
		workspaceThemes: {},
		sync: { gistId: "", auto: false, includeImages: false },
		/** "auto" follows DeepSeek Harness / the browser; otherwise a code from LANGUAGES. */
		language: "auto",
		/** Machine-maintained: stock selectors found to paint a glass surface (lets the host emit glass from the first paint). */
		cache: { glassSelectors: [], workspace: "" },
	};
}

const LIMITS = { short: 80, text: 4000, prompt: 8000, css: 60000, image: 6_000_000, prompts: 200, themes: 100 };

const str = (v, fallback, max) => (typeof v === "string" ? v.slice(0, max) : fallback);
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const num = (v, fallback, lo, hi) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback);
const oneOf = (v, list, fallback) => (list.some((x) => x.id === v) ? v : fallback);
const safeId = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : null);

/** Sentinel wallpaper source: the host serves the current Windows desktop wallpaper. */
export const DESKTOP_WALLPAPER = "desktop";
export const DESKTOP_WALLPAPER_URL = "/api/studio/desktop-wallpaper";
/** Other wallpaper sentinels: Bing's picture of the day, a slideshow from a folder, and a looping video. */
export const WALLPAPER_SOURCES = ["desktop", "bing", "folder", "video"];
export const BING_WALLPAPER_URL = "/api/studio/bing-wallpaper";
export const FOLDER_WALLPAPER_URL = "/api/studio/wallpaper-file";
export const VIDEO_WALLPAPER_URL = "/api/studio/video-wallpaper";
export const VIDEO_TYPES = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".ogv": "video/ogg" };

/** A video wallpaper: an https URL, or a local .mp4/.webm/.ogv/.m4v file path. */
function cleanVideo(v) {
	if (typeof v !== "string" || !v.trim() || v.length > 400) return "";
	const t = v.trim();
	if (/^https?:\/\//i.test(t)) return /^https?:\/\/[^\s"'()\\]+$/.test(t) ? t : "";
	return /\.(mp4|m4v|webm|ogv)$/i.test(t) && !/[<>"|?*]/.test(t.replace(/^[A-Za-z]:/, "")) ? t : "";
}

/**
 * A selector harvested from the stock stylesheets. It ends up inside CSS, so
 * only plain class/attribute/combinator syntax is accepted — nothing that could
 * close the rule or start a new one.
 */
function cleanSelector(s) {
	if (typeof s !== "string" || s.length === 0 || s.length > 300) return null;
	if (/[{};<>@\\]|\/\*|::/.test(s)) return null;
	if (!/^[A-Za-z0-9_\-.#\s>+~*[\]="'^$|:()]+$/.test(s)) return null;
	return s.trim();
}

function cleanImage(src, sentinels = [DESKTOP_WALLPAPER]) {
	if (sentinels.includes(src)) return src;
	if (typeof src !== "string" || !src) return "";
	if (src.length > LIMITS.image) return "";
	if (/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(src)) return src;
	if (/^https?:\/\/[^\s"'()\\]+$/.test(src)) return src;
	return "";
}

function cleanThemeModes(t) {
	const out = {};
	for (const mode of ["dark", "light"]) {
		const m = t?.[mode];
		const bg = normHex(m?.bg);
		const fg = normHex(m?.fg);
		const accent = normHex(m?.accent);
		if (!bg || !fg || !accent) return null;
		out[mode] = { bg, fg, accent };
		const accent2 = normHex(m?.accent2);
		if (accent2) out[mode].accent2 = accent2;
	}
	return out;
}

/** A schedule / workspace target: "theme:<id>", "look:<id>" or "builtin:<id>". */
const isTarget = (v) => typeof v === "string" && /^(look|theme|builtin):[A-Za-z0-9:_-]{1,60}$/.test(v);

/** Location for sunrise/sunset, rounded to 0.1° (about 10 km) so it isn't a precise address. */
function cleanLocation(loc) {
	const lat = num(loc?.lat, null, -90, 90);
	const lon = num(loc?.lon, null, -180, 180);
	return lat == null || lon == null ? { lat: null, lon: null } : { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 };
}

function cleanModes(list) {
	const seen = new Set();
	const out = [];
	for (const m of list.slice(0, 20)) {
		const id = safeId(m?.id);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push({
			id,
			name: str(m.name, "Mode", 40).trim() || "Mode",
			emoji: str(m.emoji, "✨", 8) || "✨",
			style: oneOf(m.style, RESPONSE_STYLES, "default"),
			language: str(m.language, "", LIMITS.short),
			instructions: str(m.instructions, "", LIMITS.text),
		});
	}
	return out;
}

/** Coerce any input (stored file, POSTed patch result, imported JSON) into a valid state. Never throws. */
export function sanitizeState(raw) {
	const d = defaultState();
	const r = raw && typeof raw === "object" ? raw : {};
	const s = {
		version: 1,
		theme: {
			active: typeof r.theme?.active === "string" && /^(default|custom:[A-Za-z0-9_-]{1,40}|[a-z0-9-]{1,40})$/.test(r.theme.active) ? r.theme.active : d.theme.active,
			tint: num(r.theme?.tint, d.theme.tint, 0, 2),
		},
		customThemes: [],
		style: {
			uiFont: oneOf(r.style?.uiFont, UI_FONTS, d.style.uiFont),
			uiFontCustom: str(r.style?.uiFontCustom, "", 300).replace(/[;{}<>]/g, ""),
			fontDir: str(r.style?.fontDir, "", 400),
			codeFont: oneOf(r.style?.codeFont, CODE_FONTS, d.style.codeFont),
			codeFontCustom: str(r.style?.codeFontCustom, "", 300).replace(/[;{}<>]/g, ""),
			radius: oneOf(r.style?.radius, RADII, d.style.radius),
			accentBubbles: bool(r.style?.accentBubbles, d.style.accentBubbles),
			accentSelection: bool(r.style?.accentSelection, d.style.accentSelection),
			ambience: oneOf(r.style?.ambience, AMBIENCES, d.style.ambience),
			ambienceStrength: num(r.style?.ambienceStrength, d.style.ambienceStrength, 0, 100),
			animate: bool(r.style?.animate, d.style.animate),
			material: oneOf(r.style?.material, MATERIALS, d.style.material),
			glassBlur: num(r.style?.glassBlur, d.style.glassBlur, 0, 60),
			glassOpacity: num(r.style?.glassOpacity, d.style.glassOpacity, 5, 95),
			glassSheen: bool(r.style?.glassSheen, d.style.glassSheen),
			reduceTransparency: bool(r.style?.reduceTransparency, false),
			focusRings: bool(r.style?.focusRings, false),
		},
		wallpaper: {
			src: cleanImage(r.wallpaper?.src, WALLPAPER_SOURCES),
			strength: num(r.wallpaper?.strength, d.wallpaper.strength, 5, 80),
			blur: num(r.wallpaper?.blur, d.wallpaper.blur, 0, 40),
			folder: str(r.wallpaper?.folder, "", 400),
			interval: Math.round(num(r.wallpaper?.interval, d.wallpaper.interval, 1, 1440)),
			video: cleanVideo(r.wallpaper?.video),
		},
		identity: {
			name: str(r.identity?.name, "", LIMITS.short),
			appName: str(r.identity?.appName, "", LIMITS.short),
			mark: ["default", "emoji", "monogram", "image"].includes(r.identity?.mark) ? r.identity.mark : d.identity.mark,
			markEmoji: str(r.identity?.markEmoji, d.identity.markEmoji, 16),
			markText: str(r.identity?.markText, "", 3),
			markImage: cleanImage(r.identity?.markImage),
			greeting: bool(r.identity?.greeting, d.identity.greeting),
			greetingTemplate: str(r.identity?.greetingTemplate, d.identity.greetingTemplate, 160),
			hideBadge: bool(r.identity?.hideBadge, d.identity.hideBadge),
		},
		persona: {
			enabled: bool(r.persona?.enabled, d.persona.enabled),
			aboutMe: str(r.persona?.aboutMe, "", LIMITS.text),
			style: oneOf(r.persona?.style, RESPONSE_STYLES, d.persona.style),
			language: str(r.persona?.language, "", LIMITS.short),
			instructions: str(r.persona?.instructions, "", LIMITS.text),
			modes: Array.isArray(r.persona?.modes) ? cleanModes(r.persona.modes) : d.persona.modes,
			mode: "",
		},
		prompts: d.prompts,
		customCss: str(r.customCss, "", LIMITS.css),
		updates: { auto: bool(r.updates?.auto, d.updates.auto) },
		looks: [],
		schedule: {
			enabled: bool(r.schedule?.enabled, false),
			entries: (Array.isArray(r.schedule?.entries) ? r.schedule.entries : [])
				.filter((e) => typeof e?.time === "string" && /^(([01]\d|2[0-3]):[0-5]\d|sunrise|sunset)$/.test(e.time) && isTarget(e.target))
				.slice(0, 24)
				.map((e) => ({ time: e.time, target: e.target })),
			applied: str(r.schedule?.applied, "", 120),
			location: cleanLocation(r.schedule?.location),
		},
		followWindows: { accent: bool(r.followWindows?.accent, false) },
		alerts: {
			enabled: bool(r.alerts?.enabled, d.alerts.enabled),
			notify: bool(r.alerts?.notify, d.alerts.notify),
			sound: oneOf(r.alerts?.sound, SOUNDS, d.alerts.sound),
			volume: num(r.alerts?.volume, d.alerts.volume, 0, 100),
			onlyWhenAway: bool(r.alerts?.onlyWhenAway, d.alerts.onlyWhenAway),
			minSeconds: num(r.alerts?.minSeconds, d.alerts.minSeconds, 0, 3600),
			needsInput: bool(r.alerts?.needsInput, d.alerts.needsInput),
		},
		layout: {
			chatWidth: oneOf(r.layout?.chatWidth, CHAT_WIDTHS, d.layout.chatWidth),
			scale: num(r.layout?.scale, d.layout.scale, 75, 140),
		},
		usage: {
			currency: oneOf(r.usage?.currency, CURRENCIES, d.usage.currency),
			rate: num(r.usage?.rate, d.usage.rate, 0.000001, 1_000_000),
			prices: cleanPrices(r.usage?.prices),
			balanceEnv: /^[A-Z_][A-Z0-9_]{0,63}$/.test(r.usage?.balanceEnv ?? "") ? r.usage.balanceEnv : d.usage.balanceEnv,
			budget: {
				daily: r.usage?.budget?.daily == null ? null : num(r.usage.budget.daily, null, 0.01, 1_000_000),
				monthly: r.usage?.budget?.monthly == null ? null : num(r.usage.budget.monthly, null, 0.01, 10_000_000),
				warnAt: Math.round(num(r.usage?.budget?.warnAt, d.usage.budget.warnAt, 10, 100)),
			},
		},
		workspaceThemes: Object.fromEntries(
			Object.entries(r.workspaceThemes && typeof r.workspaceThemes === "object" && !Array.isArray(r.workspaceThemes) ? r.workspaceThemes : {})
				.filter(([k, v]) => /^[A-Za-z0-9_.:-]{1,80}$/.test(k) && isTarget(v))
				.slice(0, 60),
		),
		sync: {
			gistId: typeof r.sync?.gistId === "string" && /^[0-9a-f]{1,64}$/i.test(r.sync.gistId) ? r.sync.gistId : "",
			auto: bool(r.sync?.auto, false),
			includeImages: bool(r.sync?.includeImages, false),
		},
		language: r.language === "auto" || LANGUAGES.some((l) => l.code === r.language) ? r.language : "auto",
		cache: {
			glassSelectors: Array.isArray(r.cache?.glassSelectors)
				? [...new Set(r.cache.glassSelectors.map(cleanSelector).filter(Boolean))].slice(0, 400)
				: [],
			workspace: typeof r.cache?.workspace === "string" && /^[A-Za-z0-9_.:-]{0,80}$/.test(r.cache.workspace) ? r.cache.workspace : "",
		},
	};
	if (Array.isArray(r.customThemes)) {
		const seen = new Set();
		for (const t of r.customThemes.slice(0, LIMITS.themes)) {
			const id = safeId(t?.id);
			const modes = cleanThemeModes(t);
			if (!id || !modes || seen.has(id)) continue;
			seen.add(id);
			s.customThemes.push({ id, name: str(t.name, "Custom theme", LIMITS.short) || "Custom theme", ...modes });
		}
	}
	if (Array.isArray(r.prompts)) {
		const seen = new Set();
		s.prompts = [];
		for (const p of r.prompts.slice(0, LIMITS.prompts)) {
			const id = safeId(p?.id);
			if (!id || seen.has(id) || typeof p.text !== "string") continue;
			seen.add(id);
			s.prompts.push({ id, title: str(p.title, "Untitled", LIMITS.short) || "Untitled", text: p.text.slice(0, LIMITS.prompt), folder: str(p.folder, "", 40).trim() });
		}
	}
	// A selection pointing at a theme that no longer exists falls back to stock.
	if (s.theme.active !== "default" && !resolveTheme(s)) s.theme.active = "default";
	if (Array.isArray(r.looks)) {
		const seen = new Set();
		for (const look of r.looks.slice(0, 40)) {
			const id = safeId(look?.id);
			if (!id || seen.has(id)) continue;
			seen.add(id);
			// A look carries the same theme/style/wallpaper sections as the settings; sanitise them the same way.
			const parts = sanitizeState({ theme: look.theme, style: look.style, wallpaper: look.wallpaper, customThemes: s.customThemes });
			s.looks.push({ id, name: str(look.name, "Look", 40) || "Look", emoji: str(look.emoji, "✨", 8) || "✨", theme: parts.theme, style: parts.style, wallpaper: parts.wallpaper });
		}
	}
	if (typeof r.persona?.mode === "string" && s.persona.modes.some((m) => m.id === r.persona.mode)) s.persona.mode = r.persona.mode;
	// "Image" with no image is just the original logo.
	if (s.identity.mark === "image" && !s.identity.markImage) s.identity.mark = "default";
	return s;
}

/** "v1.2.3" / "1.2.3-beta.1" → { major, minor, patch, pre } or null. */
export function parseVersion(text) {
	const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(text ?? "").trim());
	return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? "" } : null;
}

/** Semver-style ordering: negative if a < b, 0 if equal, positive if a > b. Unparseable versions sort lowest. */
export function compareVersions(a, b) {
	const x = parseVersion(a);
	const y = parseVersion(b);
	if (!x || !y) return (x ? 1 : 0) - (y ? 1 : 0);
	for (const key of ["major", "minor", "patch"]) if (x[key] !== y[key]) return x[key] - y[key];
	if (x.pre === y.pre) return 0;
	if (!x.pre) return 1; // a release outranks its pre-releases
	if (!y.pre) return -1;
	return x.pre < y.pre ? -1 : 1;
}

/** First version that can update and downgrade itself; older ones need Plugins → Add plugin to come back. */
export const UPDATER_SINCE = "1.3.0";

/** Deep merge for settings patches: objects merge, arrays and scalars replace. */
export function mergePatch(base, patch) {
	if (Array.isArray(patch)) return patch;
	if (patch && typeof patch === "object" && base && typeof base === "object" && !Array.isArray(base)) {
		const out = { ...base };
		for (const [k, v] of Object.entries(patch)) out[k] = mergePatch(base[k], v);
		return out;
	}
	return patch === undefined ? base : patch;
}
//#endregion

//#region greeting + persona
export function timeOfDay(date) {
	const h = date.getHours();
	if (h < 5) return "night";
	if (h < 12) return "morning";
	if (h < 18) return "afternoon";
	return "evening";
}

export const DEFAULT_GREETING = "Good {timeOfDay}, {name}";

/**
 * Fill the greeting template ({name}, {timeOfDay}, {day}); drop a dangling ", " when no name is set.
 * `lang` translates it: { tr(key) → text | undefined, locale }. The default template becomes the
 * language's own whole-sentence greeting ("greeting.morning" / "greeting.morningAnon"), since
 * "Good" + word doesn't translate piece by piece.
 */
export function renderGreeting(state, date = new Date(), lang) {
	const name = state.identity.name.trim();
	const tod = timeOfDay(date);
	const template = state.identity.greetingTemplate || DEFAULT_GREETING;
	const whole = template === DEFAULT_GREETING ? lang?.tr?.(`greeting.${tod}${name ? "" : "Anon"}`) : undefined;
	if (whole) return whole.replace(/\{name\}/g, name).trim();
	let day;
	try {
		day = date.toLocaleDateString(lang?.locale ?? "en-GB", { weekday: "long" });
	} catch {
		day = date.toLocaleDateString("en-GB", { weekday: "long" });
	}
	let text = template.replace(/\{timeOfDay\}/g, lang?.tr?.("timeOfDay." + tod) ?? tod).replace(/\{day\}/g, day).replace(/\{name\}/g, name);
	if (!name) text = text.replace(/[,，、]\s*([!.?！。？]*)\s*$/, "$1").replace(/\s{2,}/g, " ");
	return text.trim();
}

/**
 * The system-prompt section the host contributes when the persona is on.
 * Empty string = contributes nothing (the registry drops empty sections).
 */
export function personaPrompt(state) {
	const p = state.persona;
	if (!p.enabled) return "";
	const name = state.identity.name.trim();
	const lines = [];
	if (name) lines.push(`- Their name is ${name}; address them by name when it feels natural.`);
	if (p.aboutMe.trim()) lines.push(`- About them: ${p.aboutMe.trim().replace(/\n+/g, " ")}`);
	const style = RESPONSE_STYLES.find((s) => s.id === p.style);
	if (style?.text) lines.push(`- Response style: ${style.text}`);
	if (p.language.trim()) lines.push(`- Reply in ${p.language.trim()} unless they write in another language or ask otherwise.`);
	const instructions = p.instructions.trim();
	if (lines.length === 0 && !instructions) return "";
	let text = "# Personal preferences\nThe person using this harness set these preferences. Follow them unless they conflict with a task's explicit requirements or with safety.";
	if (lines.length) text += "\n\n" + lines.join("\n");
	if (instructions) text += "\n\n## Their custom instructions\n" + instructions;
	return text;
}
//#endregion

//#region stylesheet
/** Marker the browser half uses to find (and take over) the host's first-paint <style>. */
export const CSS_MARKER = "/*dsh-studio*/";

function cssString(s) {
	return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\A ") + '"';
}

function cssUrl(src) {
	return 'url("' + src.replace(/["\\\n\r]/g, "") + '")';
}

function block(selector, decls) {
	const body = Object.entries(decls).map(([k, v]) => `${k}:${v}`).join(";");
	return body ? `${selector}{${body}}` : "";
}

const GRAIN_SVG = "data:image/svg+xml;base64," + (typeof btoa === "function" ? btoa : (s) => Buffer.from(s, "binary").toString("base64"))(
	'<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>',
);

/**
 * Build the whole personalisation stylesheet for a state. Selectors use
 * `html:root body` (and the dark attribute) so they outrank the stock token
 * sheets regardless of load order, and apply from the very first paint.
 * @param state sanitised state
 * @param opts { now: Date, previewTheme?: theme to show instead of the saved one,
 *               fontFaces?: [{ url, weight, style }] served by the host for the "folder" UI font,
 *               workspace?: the open workspace id (defaults to the last one the browser reported),
 *               slide?: slideshow picture index, reduceTransparency?: the system asks for less transparency }
 */
export function buildCss(state, opts = {}) {
	const now = opts.now ?? new Date();
	// A workspace with its own theme or look shows it while open, without touching the saved settings.
	const wsTarget = workspaceTarget(state, opts.workspace ?? state.cache.workspace);
	if (wsTarget) state = applyTargetToState(state, wsTarget);
	let theme = opts.previewTheme !== undefined ? opts.previewTheme : resolveTheme(state);
	// "Use my Windows accent colour": the host passes the live accent; previews show themes as they are.
	if (state.followWindows.accent && opts.windowsAccent && opts.previewTheme === undefined) theme = withAccent(theme ?? STOCK_THEME, opts.windowsAccent);
	const st = state.style;
	const root = {};
	const light = {};
	const dark = {};

	if (theme) {
		const tokens = themeTokens(theme, state.theme.tint);
		Object.assign(light, tokens.light);
		Object.assign(dark, tokens.dark);
		// First paint: the stock sheets are not loaded yet, so paint the canvas directly.
		light["background-color"] = "var(--dsw-static-neutral-bluish-00)";
		dark["background-color"] = "var(--dsw-static-neutral-bluish-950)";
	} else {
		light["--studio-accent-2"] = "#2a8fd6";
		dark["--studio-accent-2"] = "#5fc4ff";
	}

	const ui = st.uiFont === "custom" ? st.uiFontCustom.trim() : UI_FONTS.find((f) => f.id === st.uiFont)?.stack;
	if (ui) root["--dsw-font-family"] = ui;
	const code = st.codeFont === "custom" ? st.codeFontCustom.trim() : CODE_FONTS.find((f) => f.id === st.codeFont)?.stack;
	if (code) root["--ds-font-family-code"] = code;
	const radius = RADII.find((r) => r.id === st.radius)?.scale ?? 1;
	if (radius !== 1) for (const [k, px] of Object.entries(RADIUS_BASE)) root[`--dsw-radius-${k}`] = `${Math.round(px * radius)}px`;
	// The conversation column reads --dsh-chat-user-width (dragging its edge still overrides this).
	const chatWidth = CHAT_WIDTHS.find((w) => w.id === state.layout.chatWidth)?.value;
	if (chatWidth) root["--dsh-chat-user-width"] = chatWidth;

	if (st.accentBubbles) {
		light["--dsw-specific-bubble"] = "color-mix(in srgb, var(--dsw-static-deepseek-500) 13%, var(--dsw-static-neutral-bluish-00))";
		light["--dsw-specific-bubble-highlight"] = "color-mix(in srgb, var(--dsw-static-deepseek-500) 24%, var(--dsw-static-neutral-bluish-00))";
		dark["--dsw-specific-bubble"] = "color-mix(in srgb, var(--dsw-static-deepseek-400) 20%, var(--dsw-static-neutral-bluish-900))";
		dark["--dsw-specific-bubble-highlight"] = "color-mix(in srgb, var(--dsw-static-deepseek-400) 32%, var(--dsw-static-neutral-bluish-900))";
	}

	const rules = [CSS_MARKER];
	const solidOnly = st.reduceTransparency || opts.reduceTransparency === true;
	if (st.uiFont === "folder") {
		for (const face of opts.fontFaces ?? []) {
			rules.push(`@font-face{font-family:${cssString(LOCAL_FONT_FAMILY)};src:${cssUrl(face.url)};font-weight:${face.weight | 0 || 400};font-style:${face.style === "italic" ? "italic" : "normal"};font-display:swap}`);
		}
	}
	const wall = state.wallpaper;
	if (wall.src && !solidOnly) {
		const keep = 100 - wall.strength;
		const src = wallpaperUrl(wall, now, opts.slide);
		light["--dsw-alias-bg-base"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-00) ${keep}%, transparent)`;
		dark["--dsw-alias-bg-base"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-950) ${keep}%, transparent)`;
		light["--dsw-specific-sidebar-fill"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-50) ${Math.min(100, keep + 10)}%, transparent)`;
		dark["--dsw-specific-sidebar-fill"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-900) ${Math.min(100, keep + 10)}%, transparent)`;
		light["background-color"] = "transparent";
		dark["background-color"] = "transparent";
		const blur = wall.blur ? `filter:blur(${wall.blur}px);` : "";
		if (src) rules.push(`html:root::before{content:"";position:fixed;inset:${wall.blur ? -wall.blur * 2 : 0}px;z-index:-1;pointer-events:none;background:${cssUrl(src)} center/cover no-repeat;${blur}}`);
		// A video wallpaper is a <video> the browser half adds to <body>; it sits where the picture would.
		if (wall.src === "video") rules.push(`html:root body>#studio-wall-video{position:fixed;inset:${wall.blur ? -wall.blur * 2 : 0}px;width:calc(100% + ${wall.blur * 4}px);height:calc(100% + ${wall.blur * 4}px);object-fit:cover;z-index:-1;pointer-events:none;${blur}}`);
	}

	if (st.material === "glass" && !solidOnly) addGlass(st, state.cache.glassSelectors, root, light, dark, rules);
	// Easy reading: a little more room between letters, words and lines.
	if (st.uiFont === "readable") rules.push('html:root body{letter-spacing:.02em;word-spacing:.08em}html:root body :is(p,li){line-height:1.7}');
	if (st.focusRings || theme?.id === "high-contrast") rules.push("html:root body :focus-visible{outline:3px solid var(--dsw-alias-state-business-primary)!important;outline-offset:2px!important}");

	rules.push(block("html:root,html:root body", root));
	rules.push(block("html:root body", light));
	rules.push(block("html:root body[data-ds-dark-theme]", dark));

	if (st.accentSelection) {
		rules.push("html:root body ::selection{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 34%,transparent)}");
	}

	const strength = st.ambienceStrength / 100;
	const fx = "html:root body::after{content:\"\";position:fixed;inset:0;pointer-events:none;z-index:2147483000;";
	if (st.ambience === "aurora" && strength > 0) {
		rules.push(`${fx}opacity:${(0.55 * strength).toFixed(3)};mix-blend-mode:multiply;background:radial-gradient(55% 45% at 8% 0%,color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,transparent),transparent 70%),radial-gradient(50% 40% at 100% 100%,color-mix(in srgb,var(--studio-accent-2) 55%,transparent),transparent 70%);${st.animate ? "animation:studio-aurora 22s ease-in-out infinite alternate;" : ""}}`);
		rules.push("html:root body[data-ds-dark-theme]::after{mix-blend-mode:screen}");
		rules.push("@keyframes studio-aurora{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(2%,1.5%,0) scale(1.06)}100%{transform:translate3d(-1.5%,2%,0) scale(1.03)}}");
	} else if (st.ambience === "vignette" && strength > 0) {
		rules.push(`${fx}background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,${(0.6 * strength).toFixed(3)}) 100%)}`);
	} else if (st.ambience === "grain" && strength > 0) {
		rules.push(`${fx}opacity:${(0.16 * strength).toFixed(3)};mix-blend-mode:overlay;background:url("${GRAIN_SVG}")}`);
	} else if (st.ambience === "scanlines" && strength > 0) {
		rules.push(`${fx}opacity:${(0.6 * strength).toFixed(3)};background:repeating-linear-gradient(0deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 14%,transparent) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,.35) 100%)}`);
	}
	if (st.ambience !== "none") rules.push("@media (prefers-reduced-motion: reduce){html:root body::after{animation:none}}");

	const hero = "html:root body [class*=\"_headline\"]>[class*=\"_titleGroup\"]";
	if (state.identity.greeting) {
		const text = renderGreeting(state, now, opts.greetingLang);
		if (text) {
			rules.push(`${hero}>span:first-child{display:none}`);
			rules.push(`${hero}::before{content:${cssString(text)}}`);
		}
	}
	if (state.identity.hideBadge) rules.push(`${hero}>[class*="_previewBadge"]{display:none}`);

	// Zoom the app root, not <html>: the harness's menus are portalled to <body> and positioned from
	// on-screen rects, so zooming them too would push them away from their buttons.
	if (state.layout.scale !== 100) rules.push(`html:root body>#root{zoom:${(state.layout.scale / 100).toFixed(2)}}`);

	if (state.customCss.trim()) rules.push("/* your custom CSS */\n" + state.customCss);
	return rules.filter(Boolean).join("\n");
}

/** The CSS url for a wallpaper source; "" for a video (drawn by a <video> element instead). */
export function wallpaperUrl(wall, now = new Date(), slide = 0) {
	if (wall.src === DESKTOP_WALLPAPER) return DESKTOP_WALLPAPER_URL;
	if (wall.src === "bing") return `${BING_WALLPAPER_URL}?d=${dayKey(now)}`;
	if (wall.src === "folder") return `${FOLDER_WALLPAPER_URL}?i=${slide | 0}`;
	if (wall.src === "video") return "";
	return wall.src;
}

/** Which slideshow picture is showing: advances every `interval` minutes, the same in every window. */
export function slideIndex(count, intervalMinutes, now = Date.now()) {
	if (!count) return 0;
	return Math.floor(now / (Math.max(1, intervalMinutes) * 60_000)) % count;
}

/** What each glass token paints when solid, per scheme (mirrors the stock token sheet). */
const SOLID_SURFACES = {
	light: {
		"--dsw-alias-bg-layer-1": "var(--dsw-static-neutral-bluish-00)",
		"--dsw-alias-bg-layer-2": "var(--dsw-static-neutral-bluish-00)",
		"--dsw-alias-bg-layer-3": "var(--dsw-static-neutral-bluish-00)",
		"--dsw-specific-sidebar-fill": "var(--dsw-static-neutral-bluish-50)",
		"--dsw-specific-input-major": "var(--dsw-static-neutral-bluish-00)",
		"--dsw-specific-bubble": "var(--dsw-static-deepseek-50)",
		"--dsw-alias-markdown-code-block": "var(--dsw-static-neutral-bluish-50)",
	},
	dark: {
		"--dsw-alias-bg-layer-1": "var(--dsw-static-neutral-bluish-875)",
		"--dsw-alias-bg-layer-2": "var(--dsw-static-neutral-bluish-850)",
		"--dsw-alias-bg-layer-3": "var(--dsw-static-neutral-bluish-800)",
		"--dsw-specific-sidebar-fill": "var(--dsw-static-neutral-bluish-900)",
		"--dsw-specific-input-major": "var(--dsw-static-neutral-bluish-850)",
		"--dsw-specific-bubble": "var(--dsw-static-neutral-bluish-850)",
		"--dsw-alias-markdown-code-block": "var(--dsw-static-neutral-bluish-900)",
	},
};

/**
 * Liquid glass: surfaces become translucent (with a faint white frost in dark
 * mode, like a clear-glass window), menus and harvested surface rules get a
 * backdrop blur, and a 1.5px specular top edge plus a diagonal sheen are
 * painted as background images, so no element's own box-shadow is replaced.
 */
function addGlass(st, selectors, root, light, dark, rules) {
	const keep = st.glassOpacity;
	const frost = { light: 0, dark: 7 };
	for (const [mode, tokens] of [["light", light], ["dark", dark]]) {
		for (const [token, solid] of Object.entries(SOLID_SURFACES[mode])) {
			// Keep an accent-tinted bubble's colour; everything else starts from the solid surface
			// (the wallpaper's own translucent sidebar would otherwise be thinned twice).
			const base = token === "--dsw-specific-bubble" ? tokens[token] ?? solid : solid;
			const frosted = frost[mode] ? `color-mix(in srgb, ${base}, white ${frost[mode]}%)` : base;
			tokens[token] = `color-mix(in srgb, ${frosted} ${keep}%, transparent)`;
		}
	}
	light["--dsw-menu-surface-fill"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-50) ${Math.min(94, keep + 30)}%, transparent)`;
	dark["--dsw-menu-surface-fill"] = `color-mix(in srgb, color-mix(in srgb, var(--dsw-static-neutral-bluish-800), white 6%) ${Math.min(92, keep + 25)}%, transparent)`;
	dark["--dsw-elevation-stroke-color"] = "rgba(255,255,255,.14)";
	const filter = `${st.glassBlur ? `blur(${st.glassBlur}px) ` : ""}saturate(170%)`;
	root["--dsw-menu-backdrop-filter"] = filter;
	root["--studio-glass-filter"] = filter;
	light["--studio-glass-sheen"] = st.glassSheen
		? "linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,0) 1.5px),linear-gradient(135deg,rgba(255,255,255,.4),rgba(255,255,255,0) 45%)"
		: "none";
	dark["--studio-glass-sheen"] = st.glassSheen
		? "linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 1.5px),linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,255,255,0) 45%)"
		: "none";
	if (selectors.length) {
		// :is() takes a forgiving list, so one selector the browser rejects can't void the rest.
		rules.push(`html:root body :is(${selectors.join(",")}){-webkit-backdrop-filter:var(--studio-glass-filter);backdrop-filter:var(--studio-glass-filter);background-image:var(--studio-glass-sheen)}`);
	}
}
//#endregion
//#endregion
