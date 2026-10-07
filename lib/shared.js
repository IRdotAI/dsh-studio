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
		const a = hexToOklch(m.accent);
		// A partner hue for gradients (aurora, monogram): the theme's own accent2, else an
		// analogous shift of the accent (pink→purple, blue→cyan, gold→orange).
		tokens["--studio-accent-2"] = normHex(m.accent2) ?? oklchToHex({ l: a.l, c: Math.max(0.09, a.c), h: (a.h + 305) % 360 });
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

//#region state
const DEFAULT_PROMPTS = [
	{ id: "p_explain", title: "Explain like I'm new", text: "Explain the following step by step, assuming I'm new to it. Define any jargon the first time it appears:\n\n" },
	{ id: "p_review", title: "Review for bugs", text: "Review this code for bugs, edge cases, and security issues. For each finding give the location, why it's a problem, and a fix:\n\n" },
	{ id: "p_tests", title: "Write tests", text: "Write focused unit tests for the code below. Cover the happy path, edge cases, and failure modes, using the project's existing test framework:\n\n" },
	{ id: "p_refactor", title: "Refactor for readability", text: "Refactor this for readability without changing behaviour. Briefly explain each change:\n\n" },
	{ id: "p_summary", title: "Summarise", text: "Summarise this in five bullet points, then give a one-sentence TL;DR:\n\n" },
	{ id: "p_commit", title: "Commit message", text: "Write a conventional commit message for the staged changes: a subject line of at most 72 characters, a blank line, then a short body explaining why." },
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
		},
		wallpaper: { src: "", strength: 30, blur: 0 },
		identity: {
			name: "", appName: "", mark: "default", markEmoji: "✨", markText: "", markImage: "",
			greeting: false, greetingTemplate: "Good {timeOfDay}, {name}", hideBadge: false,
		},
		persona: { enabled: false, aboutMe: "", style: "default", language: "", instructions: "" },
		prompts: DEFAULT_PROMPTS.map((p) => ({ ...p })),
		customCss: "",
		updates: { auto: false },
		/** Machine-maintained: stock selectors found to paint a glass surface (lets the host emit glass from the first paint). */
		cache: { glassSelectors: [] },
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

function cleanImage(src) {
	if (src === DESKTOP_WALLPAPER) return src;
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
		},
		wallpaper: {
			src: cleanImage(r.wallpaper?.src),
			strength: num(r.wallpaper?.strength, d.wallpaper.strength, 5, 80),
			blur: num(r.wallpaper?.blur, d.wallpaper.blur, 0, 40),
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
		},
		prompts: d.prompts,
		customCss: str(r.customCss, "", LIMITS.css),
		updates: { auto: bool(r.updates?.auto, d.updates.auto) },
		cache: {
			glassSelectors: Array.isArray(r.cache?.glassSelectors)
				? [...new Set(r.cache.glassSelectors.map(cleanSelector).filter(Boolean))].slice(0, 400)
				: [],
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
			s.prompts.push({ id, title: str(p.title, "Untitled", LIMITS.short) || "Untitled", text: p.text.slice(0, LIMITS.prompt) });
		}
	}
	// A selection pointing at a theme that no longer exists falls back to stock.
	if (s.theme.active !== "default" && !resolveTheme(s)) s.theme.active = "default";
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

/** Fill the greeting template ({name}, {timeOfDay}, {day}); drop a dangling ", " when no name is set. */
export function renderGreeting(state, date = new Date()) {
	const name = state.identity.name.trim();
	const day = date.toLocaleDateString("en-GB", { weekday: "long" });
	let text = state.identity.greetingTemplate || "Good {timeOfDay}, {name}";
	text = text.replace(/\{timeOfDay\}/g, timeOfDay(date)).replace(/\{day\}/g, day).replace(/\{name\}/g, name);
	if (!name) text = text.replace(/,\s*([!.?]*)\s*$/, "$1").replace(/\s{2,}/g, " ");
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
 *               fontFaces?: [{ url, weight, style }] served by the host for the "folder" UI font }
 */
export function buildCss(state, opts = {}) {
	const now = opts.now ?? new Date();
	const theme = opts.previewTheme !== undefined ? opts.previewTheme : resolveTheme(state);
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

	if (st.accentBubbles) {
		light["--dsw-specific-bubble"] = "color-mix(in srgb, var(--dsw-static-deepseek-500) 13%, var(--dsw-static-neutral-bluish-00))";
		light["--dsw-specific-bubble-highlight"] = "color-mix(in srgb, var(--dsw-static-deepseek-500) 24%, var(--dsw-static-neutral-bluish-00))";
		dark["--dsw-specific-bubble"] = "color-mix(in srgb, var(--dsw-static-deepseek-400) 20%, var(--dsw-static-neutral-bluish-900))";
		dark["--dsw-specific-bubble-highlight"] = "color-mix(in srgb, var(--dsw-static-deepseek-400) 32%, var(--dsw-static-neutral-bluish-900))";
	}

	const rules = [CSS_MARKER];
	if (st.uiFont === "folder") {
		for (const face of opts.fontFaces ?? []) {
			rules.push(`@font-face{font-family:${cssString(LOCAL_FONT_FAMILY)};src:${cssUrl(face.url)};font-weight:${face.weight | 0 || 400};font-style:${face.style === "italic" ? "italic" : "normal"};font-display:swap}`);
		}
	}
	const wall = state.wallpaper;
	if (wall.src) {
		const keep = 100 - wall.strength;
		const src = wall.src === DESKTOP_WALLPAPER ? DESKTOP_WALLPAPER_URL : wall.src;
		light["--dsw-alias-bg-base"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-00) ${keep}%, transparent)`;
		dark["--dsw-alias-bg-base"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-950) ${keep}%, transparent)`;
		light["--dsw-specific-sidebar-fill"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-50) ${Math.min(100, keep + 10)}%, transparent)`;
		dark["--dsw-specific-sidebar-fill"] = `color-mix(in srgb, var(--dsw-static-neutral-bluish-900) ${Math.min(100, keep + 10)}%, transparent)`;
		light["background-color"] = "transparent";
		dark["background-color"] = "transparent";
		rules.push(`html:root::before{content:"";position:fixed;inset:${wall.blur ? -wall.blur * 2 : 0}px;z-index:-1;pointer-events:none;background:${cssUrl(src)} center/cover no-repeat;${wall.blur ? `filter:blur(${wall.blur}px);` : ""}}`);
	}

	if (st.material === "glass") addGlass(st, state.cache.glassSelectors, root, light, dark, rules);

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
		const text = renderGreeting(state, now);
		if (text) {
			rules.push(`${hero}>span:first-child{display:none}`);
			rules.push(`${hero}::before{content:${cssString(text)}}`);
		}
	}
	if (state.identity.hideBadge) rules.push(`${hero}>[class*="_previewBadge"]{display:none}`);

	if (state.customCss.trim()) rules.push("/* your custom CSS */\n" + state.customCss);
	return rules.filter(Boolean).join("\n");
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
