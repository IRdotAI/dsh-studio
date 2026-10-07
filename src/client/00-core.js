/**
 * dsh-studio browser half — core: store, API, translations, toasts.
 *
 * scripts/build.mjs concatenates lib/shared.js, locales/en.json (as EN) and
 * every file in src/client/ in name order into lib/client.js.
 */
const react = require("react");
const h = react.createElement;
const { useState, useEffect, useMemo, useRef, useSyncExternalStore } = react;

const PLUGIN_ID = "dsh-studio";
const PANEL_ID = "studio";
const STUDIO_VERSION = "__STUDIO_VERSION__"; // filled in from package.json by scripts/build.mjs
const REPO_URL = "https://github.com/IRdotAI/dsh-studio";

//#region store
/** Services captured from the client context (null until injected). */
const services = { theme: null, layout: null, locale: null, uiSession: null, uiWorkspace: null, sessions: null };

let snapshot = {
	state: defaultState(),
	loaded: false,
	error: null,
	/** undefined = none; { theme } = show this theme (null = stock) without saving. */
	preview: undefined,
	themeSnap: null,
	tab: "themes",
	toast: null,
	/** What the host machine offers: desktop wallpaper, served fonts, Windows accent. */
	env: { desktopWallpaper: false, fontFaces: [], windowsAccent: null },
	/** The host updater's snapshot, or null until first loaded. */
	updates: null,
	/** Active interface language and a revision that bumps when its dictionary arrives. */
	lang: "en",
	dictRev: 0,
	/** A saved prompt waiting for its {ask:…} answers: { prompt, sessionId, asks }. */
	promptFill: null,
	focus: false,
	/** The workspace of the chat in view, and every workspace: { id, title, list: [{ id, title }] }. */
	workspace: { id: "", title: "", list: [] },
	/** Session id whose export dialog is open, or null. */
	exportFor: null,
	/** Latest budget status from the host (see budgetStatus), or null. */
	budget: null,
};
const listeners = new Set();

function setSnap(patch) {
	snapshot = { ...snapshot, ...patch };
	for (const listener of [...listeners]) listener();
}
function subscribe(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
function useSnap(select) {
	return useSyncExternalStore(subscribe, () => select(snapshot));
}

/** A host message ({ code, params, text }) or plain string in the interface language. */
function hostText(m) {
	if (m == null) return "";
	if (typeof m !== "object") return String(m);
	const params = {};
	for (const [k, v] of Object.entries(m.params ?? {})) params[k] = v && typeof v === "object" ? hostText(v) : v;
	const key = "host." + m.code;
	return dict[key] || EN[key] ? t(key, params) : String(m.text ?? m.code);
}
const errorText = (e) => (e?.info ? hostText(e.info) : String(e?.message ?? e));

async function apiGet(path) {
	const res = await fetch("/api/studio/" + path, { cache: "no-store" });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const error = new Error(data.error || "HTTP " + res.status);
		error.info = data.errorInfo;
		throw error;
	}
	return data;
}
async function apiPost(path, body) {
	const res = await fetch("/api/studio/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		const error = new Error(data.error || "HTTP " + res.status);
		error.data = data;
		error.info = data.errorInfo;
		throw error;
	}
	return data;
}
//#endregion

//#region translations
let dict = EN;
const dictCache = new Map([["en", EN]]);

/** Translate a key, filling {placeholders}; falls back to English, then to the key itself. */
function t(key, params) {
	let text = dict[key] ?? EN[key] ?? key;
	if (params) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
	return text;
}
/** Translate when a key exists, otherwise use the given fallback text (data-driven labels). */
function tOr(key, fallback) {
	return dict[key] ?? EN[key] ?? fallback;
}
/** Re-render on language change: call at the top of components that render text. */
function useT() {
	useSnap((s) => s.dictRev);
	return t;
}

/** The language "auto" means: DeepSeek Harness's own language when it's Chinese, else the browser's. */
function resolveLanguage() {
	const chosen = snapshot.state.language;
	if (chosen !== "auto") return chosen;
	const harness = services.locale?.getLocale?.()?.active;
	if (typeof harness === "string" && harness.toLowerCase().startsWith("zh")) return matchLanguage([harness]);
	return matchLanguage(typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : []);
}

async function syncLanguage() {
	const code = resolveLanguage();
	if (code === snapshot.lang && dictCache.has(code)) return;
	if (!dictCache.has(code)) {
		try {
			dictCache.set(code, await apiGet("locale?lang=" + encodeURIComponent(code)));
		} catch {
			dictCache.set(code, EN); // missing translation: English, quietly
		}
	}
	dict = dictCache.get(code);
	setSnap({ lang: code, dictRev: snapshot.dictRev + 1 });
}

const langDir = (code) => LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";

/** Translations for the new-chat greeting (see renderGreeting). */
const greetingLang = () => ({ tr: (key) => dict[key] ?? EN[key], locale: snapshot.lang });
//#endregion

//#region persistence
let pendingPatch = null;
let saveTimer = null;

/** Apply a settings patch locally at once, then persist it (debounced, patches coalesce). */
function update(patch) {
	setSnap({ state: sanitizeState(mergePatch(snapshot.state, patch)) });
	pendingPatch = pendingPatch ? mergePatch(pendingPatch, patch) : patch;
	clearTimeout(saveTimer);
	saveTimer = setTimeout(flushSave, 350);
}

async function flushSave() {
	saveTimer = null;
	const body = pendingPatch;
	pendingPatch = null;
	if (!body) return;
	try {
		const res = await apiPost("patch", body);
		setSnap({ error: null, ...(res.env ? { env: res.env } : {}) });
	} catch (e) {
		setSnap({ error: t("error.save", { error: errorText(e) }) });
	}
}

/** Adopt settings the host changed on its own (restore from backup, import). */
function adoptState(res) {
	setSnap({ state: sanitizeState(res.state), error: null, ...(res.env ? { env: res.env } : {}) });
}

async function replaceState(full) {
	adoptState(await apiPost("replace", full));
}

async function resetState() {
	adoptState(await apiPost("reset", { confirm: "reset-studio" }));
}

async function load() {
	try {
		const res = await apiGet("state");
		setSnap({ state: sanitizeState(res.state), loaded: true, error: null, ...(res.env ? { env: res.env } : {}) });
	} catch (e) {
		setSnap({ loaded: true, error: t("error.load", { error: errorText(e) }) });
	}
	void syncLanguage();
}

async function refreshEnv() {
	try {
		const res = await apiGet("state");
		if (res.env) setSnap({ env: res.env });
	} catch { /* offline */ }
}
//#endregion

//#region toasts
let toastTimer = null;
function toast(text) {
	clearTimeout(toastTimer);
	setSnap({ toast: text });
	toastTimer = setTimeout(() => setSnap({ toast: null }), 2600);
}
//#endregion
