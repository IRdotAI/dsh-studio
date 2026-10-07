/**
 * dsh-studio browser half (source).
 *
 * scripts/build.mjs wraps this file, with lib/shared.js inlined above it,
 * into the ModuleLoader bundle at lib/client.js. Edit here, then run
 * `node scripts/build.mjs`.
 */
const react = require("react");
const h = react.createElement;
const { useState, useEffect, useMemo, useRef, useSyncExternalStore } = react;

const PLUGIN_ID = "dsh-studio";
const PANEL_ID = "studio";

//#region styles
const STUDIO_CSS = `
.st_page{box-sizing:border-box;height:100%;overflow:auto;color:var(--dsw-alias-label-primary);padding:0 clamp(20px,4vw,48px) 72px}
.st_inner{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.st_head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding-top:28px;flex-wrap:wrap}
.st_title{margin:0;font-size:22px;font-weight:600;line-height:30px;display:flex;align-items:center;gap:10px}
.st_titleMark{display:inline-flex;width:30px;height:30px;border-radius:var(--dsw-radius-sm);align-items:center;justify-content:center;color:var(--dsw-alias-label-primary-foreground);background:linear-gradient(135deg,var(--dsw-alias-state-business-primary),var(--studio-accent-2,#c46be0))}
.st_sub{margin:4px 0 0;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}
.st_kbd{font-family:var(--ds-font-family-code);font-size:11px;padding:1px 6px;border-radius:5px;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary)}
.st_tabs{position:sticky;top:0;z-index:3;display:flex;gap:4px;flex-wrap:wrap;padding:10px 0;background:var(--dsw-alias-bg-base);border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_tab{border:0;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:6px 12px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.st_tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
.st_tab[aria-selected=true]{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font-weight:500}
.st_banner{border-radius:var(--dsw-radius-sm);padding:9px 12px;font-size:13px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent)}
.st_section{display:flex;flex-direction:column;gap:14px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);padding:18px 20px}
.st_sectionHead h3{margin:0;font-size:15px;font-weight:600;line-height:22px}
.st_sectionHead p{margin:2px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12.5px;line-height:18px}
.st_row{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end}
.st_field{display:flex;flex-direction:column;gap:6px;min-width:180px;flex:1}
.st_field_narrow{flex:0 0 auto;min-width:0}
.st_label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.st_hint{font-size:11.5px;color:var(--dsw-alias-label-tertiary);line-height:16px}
.st_input{box-sizing:border-box;width:100%;font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);padding:7px 10px}
.st_input:focus{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:0}
textarea.st_input{resize:vertical;min-height:96px;line-height:1.5}
.st_mono{font-family:var(--ds-font-family-code);font-size:12px}
.st_btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);padding:6px 12px;cursor:pointer;white-space:nowrap}
.st_btn:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
.st_btn[disabled]{opacity:.5;cursor:default}
.st_btn_primary{background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground);border-color:transparent}
.st_btn_primary:hover{background:var(--dsw-alias-state-business-primary);filter:brightness(1.08)}
.st_btn_danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 45%,transparent)}
.st_btn_small{padding:3px 8px;font-size:12px}
.st_seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:2px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform)}
.st_segBtn{border:0;background:none;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-secondary);padding:5px 11px;border-radius:calc(var(--dsw-radius-sm) - 2px);cursor:pointer}
.st_segBtn[aria-pressed=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.st_toggle{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:13px;line-height:20px}
.st_switch{flex:none;position:relative;width:32px;height:18px;margin-top:1px;border-radius:999px;background:var(--dsw-alias-bg-overlay);transition:background .15s}
.st_switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-switch-thumb,#fff);transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
.st_switch[data-on=true]{background:var(--dsw-alias-state-business-primary)}
.st_switch[data-on=true]::after{transform:translateX(14px);background:#fff}
.st_toggleText{display:flex;flex-direction:column}
.st_toggle input:focus-visible+.st_switch{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.st_range{width:100%;accent-color:var(--dsw-alias-state-business-primary)}
.st_rangeHead{display:flex;justify-content:space-between;font-size:12px;color:var(--dsw-alias-label-secondary)}
.st_grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:12px}
.st_card{display:flex;flex-direction:column;gap:0;padding:0;overflow:hidden;font:inherit;text-align:left;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);cursor:pointer;transition:transform .12s,box-shadow .12s}
.st_card:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.18)}
.st_card_active{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.st_cardMocks{display:grid;grid-template-columns:1fr 1fr;height:92px}
.st_cardFoot{display:flex;align-items:center;gap:8px;padding:9px 12px}
.st_cardName{font-size:13px;font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st_cardCheck{font-size:12px;color:var(--dsw-alias-state-business-primary);font-weight:600}
.st_mock{display:flex;height:100%;min-width:0}
.st_mockSide{width:24%;display:flex;flex-direction:column;gap:5px;padding:9px 5px}
.st_mockSide i{display:block;height:4px;border-radius:2px}
.st_mockMain{flex:1;display:flex;flex-direction:column;gap:6px;padding:10px 9px;min-width:0}
.st_mockMain i{display:block;border-radius:3px}
.st_mockBubble{align-self:flex-end;width:48%;height:10px;border-radius:5px!important}
.st_mockLine{height:4px}
.st_mockPill{width:30%;height:9px;border-radius:5px!important;margin-top:auto}
.st_editorGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.st_modeCol{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:var(--dsw-radius-md);border:.5px solid var(--dsw-alias-border-l4)}
.st_modeTitle{font-size:13px;font-weight:600}
.st_color{display:flex;align-items:center;gap:8px}
.st_color input[type=color]{flex:none;width:34px;height:30px;padding:0;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-xs);background:none;cursor:pointer}
.st_color .st_input{width:96px;font-family:var(--ds-font-family-code);font-size:12px}
.st_color .st_label{flex:1}
.st_badge{font-size:11px;padding:1px 7px;border-radius:999px;font-variant-numeric:tabular-nums;white-space:nowrap}
.st_badge_ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 16%,transparent);color:var(--dsw-alias-state-success-primary)}
.st_badge_warn{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 18%,transparent);color:var(--dsw-alias-state-warn-label,var(--dsw-alias-state-warn-primary))}
.st_bigMock{height:120px;border-radius:var(--dsw-radius-sm);overflow:hidden;border:.5px solid var(--dsw-alias-border-l2)}
.st_pre{margin:0;white-space:pre-wrap;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.55;padding:12px 14px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);max-height:320px;overflow:auto}
.st_promptRow{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_promptRow:last-child{border-bottom:0}
.st_promptBody{flex:1;min-width:0}
.st_promptTitle{font-size:13px;font-weight:500}
.st_promptText{font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st_actions{display:flex;gap:6px;flex-wrap:wrap}
.st_identityPreview{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-specific-sidebar-fill);border:.5px solid var(--dsw-alias-border-l2);width:fit-content;min-width:220px}
.st_greetPreview{font-size:22px;font-weight:500;line-height:30px}
.st_brandName{font-size:15px;font-weight:500;line-height:20px;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block}
.st_markEmoji{display:inline-flex;align-items:center;justify-content:center;line-height:1}
.st_markMono{display:inline-flex;align-items:center;justify-content:center;border-radius:28%;font-weight:700;letter-spacing:-.02em;color:#fff;background:linear-gradient(135deg,var(--dsw-alias-state-business-primary),var(--studio-accent-2,#c46be0));text-transform:uppercase}
.st_markImg{border-radius:24%;object-fit:cover}
.st_markThumb{position:relative;width:56px;height:56px;flex:none}
.st_markThumb img{width:56px;height:56px;border-radius:24%;object-fit:cover;border:.5px solid var(--dsw-alias-border-l4);display:block}
.st_markRemove{position:absolute;top:-8px;right:-8px;width:22px;height:22px;padding:0;border-radius:50%;corner-shape:round;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:15px;line-height:1;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l4);box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer}
.st_markRemove:hover,.st_markRemove:focus-visible{background:var(--dsw-alias-state-error-primary);color:#fff;border-color:transparent}
.st_wallThumb{width:160px;height:90px;border-radius:var(--dsw-radius-sm);background-size:cover;background-position:center;border:.5px solid var(--dsw-alias-border-l4)}
.st_backdrop{position:fixed;inset:0;z-index:2147483100;background:var(--dsw-alias-bg-mask-2,rgba(0,0,0,.2));display:flex;justify-content:center;align-items:flex-start;padding-top:12vh}
.st_palette{width:min(640px,92vw);max-height:min(560px,72vh);display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
.st_paletteInput{border:0;outline:0;background:none;font:inherit;font-size:15px;color:inherit;padding:16px 18px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.st_paletteList{overflow:auto;padding:6px}
.st_paletteGroup{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:10px 12px 4px}
.st_paletteItem{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;font:inherit;font-size:13.5px;color:inherit;text-align:left;padding:8px 12px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.st_paletteItem[data-active=true]{background:var(--dsw-alias-interactive-bg-active)}
.st_paletteIcon{width:20px;text-align:center;flex:none}
.st_paletteLabel{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st_paletteHint{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.st_paletteFoot{display:flex;gap:14px;padding:8px 14px;border-top:.5px solid var(--dsw-alias-border-l2);font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.st_paletteEmpty{padding:24px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:13px}
.st_toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483200;background:var(--dsw-alias-toast-bg);color:var(--dsw-alias-toast-label);padding:8px 16px;border-radius:999px;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.3);pointer-events:none;animation:st_toast_in .18s ease-out}
@keyframes st_toast_in{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
.st_cbWrap{position:relative;display:inline-flex}
.st_cbBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm);background:none;color:var(--dsw-alias-label-secondary);cursor:pointer}
.st_cbBtn:hover,.st_cbBtn[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-business-primary)}
.st_cbMenu{position:absolute;left:0;bottom:calc(100% + 8px);z-index:60;width:min(340px,80vw);max-height:320px;overflow:auto;padding:6px;background:var(--dsw-alias-bg-layer-2);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);box-shadow:0 12px 36px rgba(0,0,0,.28)}
.st_cbHead{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:6px 10px 4px}
.st_cbItem{display:flex;flex-direction:column;gap:1px;width:100%;border:0;background:none;font:inherit;text-align:left;color:var(--dsw-alias-label-primary);padding:7px 10px;border-radius:var(--dsw-radius-sm);cursor:pointer}
.st_cbItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.st_cbItemTitle{font-size:13px}
.st_cbItemText{font-size:11.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st_cbManage{width:100%;border:0;border-top:.5px solid var(--dsw-alias-border-l2);background:none;font:inherit;font-size:12px;color:var(--dsw-alias-state-business-primary);text-align:left;padding:8px 10px 4px;margin-top:4px;cursor:pointer}
.st_section,.st_palette,.st_cbMenu,.st_card{-webkit-backdrop-filter:var(--studio-glass-filter,none);backdrop-filter:var(--studio-glass-filter,none);background-image:var(--studio-glass-sheen,none)}
.st_look{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 20px;border-radius:var(--dsw-radius-lg);border:.5px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 40%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),color-mix(in srgb,var(--studio-accent-2,#5ad8e0) 12%,transparent))}
.st_lookText{flex:1;min-width:220px}
.st_lookTitle{font-size:15px;font-weight:600;line-height:22px}
.st_lookDesc{font-size:12.5px;color:var(--dsw-alias-label-secondary);line-height:18px}
`;
//#endregion

//#region store
/** Services captured from the client context (null until injected). */
const services = { theme: null, layout: null };

let snapshot = {
	state: defaultState(),
	loaded: false,
	error: null,
	/** undefined = none; { theme } = show this theme (null = stock) without saving. */
	preview: undefined,
	themeSnap: null,
	tab: "themes",
	toast: null,
	/** What the host machine offers: { desktopWallpaper: boolean, fontFaces: [{ url, weight, style }] }. */
	env: { desktopWallpaper: false, fontFaces: [] },
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

const errorText = (e) => String(e?.message ?? e);

async function apiGet(path) {
	const res = await fetch("/api/studio/" + path, { cache: "no-store" });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
	return data;
}
async function apiPost(path, body) {
	const res = await fetch("/api/studio/" + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
	return data;
}

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
		setSnap({ error: "Couldn't save your Studio settings: " + errorText(e) });
	}
}

async function replaceState(full) {
	const res = await apiPost("replace", full);
	setSnap({ state: sanitizeState(res.state), error: null, ...(res.env ? { env: res.env } : {}) });
}

async function resetState() {
	const res = await apiPost("reset", { confirm: "reset-studio" });
	setSnap({ state: sanitizeState(res.state), error: null, ...(res.env ? { env: res.env } : {}) });
}

async function load() {
	try {
		const res = await apiGet("state");
		setSnap({ state: sanitizeState(res.state), loaded: true, error: null, ...(res.env ? { env: res.env } : {}) });
	} catch (e) {
		setSnap({ loaded: true, error: "Couldn't load your Studio settings (is the dsh-studio host plugin enabled?): " + errorText(e) });
	}
}

let toastTimer = null;
function toast(text) {
	clearTimeout(toastTimer);
	setSnap({ toast: text });
	toastTimer = setTimeout(() => setSnap({ toast: null }), 2200);
}
//#endregion

//#region live stylesheet
let styleEl = null;
let lastCss = "";

/** Take over the host's first-paint <style> (found by its marker) or create one. */
function ensureStyleEl() {
	if (styleEl?.isConnected) return styleEl;
	styleEl = [...document.querySelectorAll("style")].find((s) => s.textContent.trimStart().startsWith(CSS_MARKER)) ?? null;
	if (!styleEl) {
		styleEl = document.createElement("style");
		document.head.appendChild(styleEl);
	}
	styleEl.dataset.studio = "theme";
	return styleEl;
}

function applyCss() {
	// Until settings load, the host's first-paint sheet is already correct — leave it alone.
	if (!snapshot.loaded || typeof document === "undefined") return;
	let css;
	try {
		css = buildCss(snapshot.state, {
			fontFaces: snapshot.env.fontFaces,
			...(snapshot.preview ? { previewTheme: snapshot.preview.theme } : {}),
		});
	} catch (e) {
		console.warn("dsh-studio: stylesheet build failed", e);
		return;
	}
	if (css === lastCss && styleEl?.isConnected) return;
	lastCss = css;
	ensureStyleEl().textContent = css;
}
//#endregion

//#region glass surface discovery
/**
 * Find every stock rule whose background is exactly one of the glass tokens,
 * straight from the live stylesheets. Stock class names are hashed per build,
 * so harvesting them at runtime keeps glass working across harness updates.
 */
function discoverGlassSelectors() {
	const found = new Set();
	const visit = (rules) => {
		for (const rule of rules) {
			if (rule.cssRules && !rule.selectorText) {
				visit(rule.cssRules); // @media / @supports / @layer
				continue;
			}
			if (!rule.selectorText || !rule.style) continue;
			const bg = (rule.style.getPropertyValue("background") || rule.style.getPropertyValue("background-color")).trim();
			const token = /^var\((--[\w-]+)\)$/.exec(bg)?.[1];
			if (!token || !GLASS_TOKENS.includes(token)) continue;
			for (const part of rule.selectorText.split(",")) {
				const sel = part.trim();
				if (!sel || /::|:hover|:focus|:active|:checked|^(html|body|:root)\b/.test(sel)) continue;
				found.add(sel);
			}
		}
	};
	for (const sheet of document.styleSheets) {
		const owner = sheet.ownerNode;
		if (owner?.dataset?.studio || owner?.dataset?.plugin === PLUGIN_ID) continue;
		try {
			visit(sheet.cssRules);
		} catch { /* cross-origin sheet */ }
	}
	return [...found].sort().slice(0, 400);
}

/** Re-harvest while glass is on; persist changes so the host's first-paint sheet carries them. */
function syncGlassSelectors() {
	if (!snapshot.loaded || snapshot.state.style.material !== "glass") return;
	// Compare in sanitised form, or a selector the validator drops would trigger a save on every check.
	const next = sanitizeState({ cache: { glassSelectors: discoverGlassSelectors() } }).cache.glassSelectors;
	const prev = snapshot.state.cache.glassSelectors;
	if (next.length === prev.length && next.every((s, i) => s === prev[i])) return;
	update({ cache: { glassSelectors: next } });
}
//#endregion

//#region actions
const STOCK = {
	id: "default", name: "DeepSeek", emoji: "🐋", description: "The harness's own palette.",
	dark: { bg: "#151517", fg: "#f9fafb", accent: "#7aaaff" }, light: { bg: "#ffffff", fg: "#0f1115", accent: "#4176e6" },
};

/** Every selectable theme as { id (state.theme.active value), name, emoji, description, theme }. */
function themeChoices(state) {
	return [
		{ id: "default", name: STOCK.name, emoji: STOCK.emoji, description: STOCK.description, theme: STOCK },
		...PRESETS.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, description: p.description, theme: p })),
		...state.customThemes.map((c) => ({ id: "custom:" + c.id, name: c.name, emoji: "🎨", description: "Your theme", theme: c, custom: true })),
	];
}

function applyTheme(id) {
	const choice = themeChoices(snapshot.state).find((c) => c.id === id);
	update({ theme: { active: id } });
	if (choice) toast(`Theme: ${choice.name}`);
}

function surprise() {
	const t = randomTheme();
	const others = snapshot.state.customThemes.filter((c) => c.id !== "surprise");
	update({ customThemes: [...others, { ...t, name: "Surprise · " + t.name }], theme: { active: "custom:surprise" } });
	toast(`🎲 ${t.name}`);
}

/** Apply a whole look; its desktop wallpaper only where the host can actually serve one. */
function applyLook(look) {
	const patch = mergePatch({}, look.patch);
	if (patch.wallpaper?.src === DESKTOP_WALLPAPER && !snapshot.env.desktopWallpaper) delete patch.wallpaper;
	update(patch);
	toast(`Look: ${look.name}`);
}

function setAppearance(pref) {
	try {
		services.theme?.setTheme(pref);
		toast(`Appearance: ${pref === "system" ? "match system" : pref}`);
	} catch (e) {
		toast(errorText(e));
	}
}

function bumpFontSize(delta) {
	const theme = services.theme;
	if (!theme) return;
	const current = theme.getTheme().fontSize;
	const next = Math.min(22, Math.max(10, current + delta));
	if (next !== current) theme.setFontSize(next);
	toast(`Text size: ${next}px`);
}

function openStudio(tab) {
	if (tab) setSnap({ tab });
	try {
		services.layout?.selectPanel(PANEL_ID);
	} catch (e) {
		toast(errorText(e));
	}
}

/** Open composers by Session id, registered by the composer button. */
const composers = new Map();
let lastComposer = null;

function copyText(text) {
	try {
		void navigator.clipboard?.writeText(text);
		return true;
	} catch {
		return false;
	}
}

function insertPrompt(prompt, sessionId) {
	const entry = composers.get(sessionId ?? lastComposer) ?? [...composers.values()].pop();
	if (!entry) {
		toast(copyText(prompt.text) ? "No open chat — prompt copied to clipboard" : "Open a chat first");
		return;
	}
	const { actions, getDraft } = entry;
	try {
		if (actions.insertText(prompt.text, actions.captureInsertion())) return;
	} catch { /* fall back to setDraft */ }
	const draft = getDraft();
	actions.setDraft(draft ? draft.replace(/\s+$/, "") + "\n\n" + prompt.text : prompt.text);
}
//#endregion

//#region small helpers + atoms
const cls = (...names) => names.filter(Boolean).join(" ");
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function mix(a, b, t) {
	const A = parseHex(a);
	const B = parseHex(b);
	if (!A || !B) return a;
	return "#" + A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255).toString(16).padStart(2, "0")).join("");
}

function PaletteIcon({ size = 16, className }) {
	return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", className, "aria-hidden": true },
		h("path", { d: "M8 1.75a6.25 6.25 0 1 0 0 12.5c.9 0 1.4-.6 1.4-1.3 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.3 1.4-1.3h1.6c1.6 0 2.65-1.2 2.65-2.8C14.25 4.2 11.5 1.75 8 1.75Z", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" }),
		h("circle", { cx: 4.8, cy: 7.3, r: 1, fill: "currentColor" }),
		h("circle", { cx: 6.8, cy: 4.6, r: 1, fill: "currentColor" }),
		h("circle", { cx: 10.1, cy: 4.7, r: 1, fill: "currentColor" }),
	);
}

function SparkIcon({ size = 16, className }) {
	return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", className, "aria-hidden": true },
		h("path", { d: "M7 1.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5 2.9-.3 4.2-1.6 4.5-4.5Z", fill: "currentColor" }),
		h("path", { d: "M12.5 9.5c.15 1.4.8 2.05 2.2 2.2-1.4.15-2.05.8-2.2 2.2-.15-1.4-.8-2.05-2.2-2.2 1.4-.15 2.05-.8 2.2-2.2Z", fill: "currentColor", opacity: 0.7 }),
	);
}

function Section({ title, description, children, actions }) {
	return h("section", { className: "st_section" },
		h("div", { className: "st_row", style: { justifyContent: "space-between", alignItems: "flex-start" } },
			h("div", { className: "st_sectionHead" }, h("h3", null, title), description ? h("p", null, description) : null),
			actions ?? null,
		),
		react.Children.toArray(children),
	);
}

/** A labelled control. `group` renders a <div> for button groups, which must not sit inside a <label>. */
function Field({ label, hint, children, narrow, group }) {
	return h(group ? "div" : "label", { className: cls("st_field", narrow && "st_field_narrow"), role: group ? "group" : undefined },
		label ? h("span", { className: "st_label" }, label) : null,
		react.Children.toArray(children),
		hint ? h("span", { className: "st_hint" }, hint) : null,
	);
}

function Button({ kind, small, children, ...rest }) {
	return h("button", { type: "button", className: cls("st_btn", kind && "st_btn_" + kind, small && "st_btn_small"), ...rest }, children);
}

function Segmented({ value, options, onChange, label }) {
	return h("div", { className: "st_seg", role: "group", "aria-label": label },
		options.map((o) => h("button", { key: o.id, type: "button", className: "st_segBtn", "aria-pressed": o.id === value, onClick: () => onChange(o.id) }, o.label)));
}

function Toggle({ checked, onChange, label, hint }) {
	return h("label", { className: "st_toggle" },
		h("input", { type: "checkbox", checked, onChange: (e) => onChange(e.target.checked), style: { position: "absolute", opacity: 0, width: 1, height: 1 } }),
		h("span", { className: "st_switch", "data-on": String(Boolean(checked)), "aria-hidden": true }),
		h("span", { className: "st_toggleText" }, h("span", null, label), hint ? h("span", { className: "st_hint" }, hint) : null),
	);
}

function Slider({ label, value, min, max, step = 1, onChange, format }) {
	return h("label", { className: "st_field" },
		h("span", { className: "st_rangeHead" }, h("span", null, label), h("span", null, format ? format(value) : value)),
		h("input", { type: "range", className: "st_range", min, max, step, value, onChange: (e) => onChange(Number(e.target.value)) }),
	);
}

function Select({ value, options, onChange }) {
	return h("select", { className: "st_input", value, onChange: (e) => onChange(e.target.value) },
		options.map((o) => h("option", { key: o.id, value: o.id }, o.label)));
}

/** Text input that only commits on blur / Enter — for values that are costly to apply per keystroke. */
function useDebounced(value, commit, ms = 400) {
	const [draft, setDraft] = useState(value);
	const timer = useRef(null);
	const latest = useRef(value);
	useEffect(() => {
		if (value !== latest.current) {
			latest.current = value;
			setDraft(value);
		}
	}, [value]);
	useEffect(() => () => clearTimeout(timer.current), []);
	const onChange = (next) => {
		setDraft(next);
		latest.current = next;
		clearTimeout(timer.current);
		timer.current = setTimeout(() => commit(next), ms);
	};
	return [draft, onChange];
}

function TextInput({ value, onCommit, placeholder, mono, maxLength }) {
	const [draft, setDraft] = useDebounced(value, onCommit, 350);
	return h("input", { className: cls("st_input", mono && "st_mono"), value: draft, placeholder, maxLength, onChange: (e) => setDraft(e.target.value) });
}

function TextArea({ value, onCommit, placeholder, rows = 4, mono }) {
	const [draft, setDraft] = useDebounced(value, onCommit, 500);
	return h("textarea", { className: cls("st_input", mono && "st_mono"), value: draft, placeholder, rows, spellCheck: !mono, onChange: (e) => setDraft(e.target.value) });
}

async function imageFileToDataUrl(file, maxDim, type, quality) {
	const url = URL.createObjectURL(file);
	try {
		const img = await new Promise((resolve, reject) => {
			const i = new Image();
			i.onload = () => resolve(i);
			i.onerror = () => reject(new Error("couldn't read that image"));
			i.src = url;
		});
		const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
		const w = Math.max(1, Math.round(img.naturalWidth * scale));
		const ht = Math.max(1, Math.round(img.naturalHeight * scale));
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = ht;
		canvas.getContext("2d").drawImage(img, 0, 0, w, ht);
		return canvas.toDataURL(type, quality);
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Open the file picker; resolves with the chosen file, or null if the picker is cancelled. */
function pickFile(accept) {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}
//#endregion

//#region theme previews
function Mock({ m }) {
	const side = mix(m.bg, m.fg, 0.06);
	const muted = mix(m.bg, m.fg, 0.42);
	return h("div", { className: "st_mock", style: { background: m.bg } },
		h("div", { className: "st_mockSide", style: { background: side } },
			h("i", { style: { background: mix(m.bg, m.fg, 0.3) } }),
			h("i", { style: { background: mix(m.bg, m.fg, 0.2) } }),
			h("i", { style: { background: mix(side, m.accent, 0.6) } }),
		),
		h("div", { className: "st_mockMain" },
			h("i", { className: "st_mockBubble", style: { background: mix(m.bg, m.accent, 0.2) } }),
			h("i", { className: "st_mockLine", style: { background: m.fg, width: "80%" } }),
			h("i", { className: "st_mockLine", style: { background: muted, width: "58%" } }),
			h("i", { className: "st_mockLine", style: { background: muted, width: "68%" } }),
			h("i", { className: "st_mockPill", style: { background: m.accent } }),
		),
	);
}

function ThemeCard({ choice, active, onPick }) {
	return h("button", { type: "button", className: cls("st_card", active && "st_card_active"), onClick: onPick, "aria-pressed": active, title: choice.description },
		h("div", { className: "st_cardMocks" }, h(Mock, { m: choice.theme.dark }), h(Mock, { m: choice.theme.light })),
		h("div", { className: "st_cardFoot" },
			h("span", { "aria-hidden": true }, choice.emoji),
			h("span", { className: "st_cardName" }, choice.name),
			active ? h("span", { className: "st_cardCheck" }, "✓ Active") : null,
		),
	);
}

function ContrastBadge({ fg, bg, min, label }) {
	const ratio = contrast(fg, bg);
	return h("span", { className: cls("st_badge", ratio >= min ? "st_badge_ok" : "st_badge_warn"), title: `${label} contrast ${ratio.toFixed(2)}:1 (aim for ${min}:1 or more)` },
		`${ratio.toFixed(1)}:1`);
}
//#endregion

//#region tabs
function ThemesTab() {
	const state = useSnap((s) => s.state);
	const themeSnap = useSnap((s) => s.themeSnap);
	const choices = themeChoices(state);
	const builtIn = choices.filter((c) => !c.custom);
	const custom = choices.filter((c) => c.custom);
	const pick = (id) => applyTheme(id);
	return [
		...LOOKS.map((look) => h("div", { key: "look:" + look.id, className: "st_look" },
			h("span", { style: { fontSize: 28 }, "aria-hidden": true }, "🫧"),
			h("div", { className: "st_lookText" },
				h("div", { className: "st_lookTitle" }, look.name),
				h("div", { className: "st_lookDesc" }, look.description)),
			h(Button, { kind: "primary", onClick: () => applyLook(look) }, "Match my desktop"))),
		h(Section, {
			key: "mode",
			title: "Appearance",
			description: "Every theme ships a light and a dark version — this switch picks which one you see.",
		},
			h("div", { className: "st_row" },
				services.theme && themeSnap
					? h(Field, { label: "Mode", narrow: true, group: true },
						h(Segmented, {
							label: "Appearance",
							value: themeSnap.preference,
							options: [{ id: "light", label: "☀️ Light" }, { id: "dark", label: "🌙 Dark" }, { id: "system", label: "💻 System" }],
							onChange: setAppearance,
						}))
					: null,
				services.theme && themeSnap
					? h(Field, { label: "Chat text size", narrow: true, group: true },
						h("div", { className: "st_row", style: { gap: 6, alignItems: "center" } },
							h(Button, { small: true, onClick: () => bumpFontSize(-1), "aria-label": "Smaller text" }, "A−"),
							h("span", { className: "st_label", style: { minWidth: 36, textAlign: "center" } }, `${themeSnap.fontSize}px`),
							h(Button, { small: true, onClick: () => bumpFontSize(1), "aria-label": "Larger text" }, "A+"),
						))
					: null,
				h(Slider, {
					label: "Surface tint",
					value: Math.round(state.theme.tint * 100),
					min: 0, max: 200, step: 5,
					format: (v) => (v === 0 ? "grey" : `${v}%`),
					onChange: (v) => update({ theme: { tint: v / 100 } }),
				}),
			),
		),
		h(Section, {
			key: "presets",
			title: "Themes",
			description: "Click to apply. Tip: press Ctrl+K and arrow through themes to preview them live.",
			actions: h("div", { className: "st_actions" },
				h(Button, { onClick: surprise }, "🎲 Surprise me"),
				h(Button, { onClick: () => setSnap({ tab: "editor" }) }, "🎨 Make your own"),
			),
		},
			h("div", { className: "st_grid" }, builtIn.map((c) => h(ThemeCard, { key: c.id, choice: c, active: state.theme.active === c.id, onPick: () => pick(c.id) }))),
		),
		custom.length
			? h(Section, { key: "custom", title: "Your themes", description: "Made in the theme editor (or by the dice)." },
				h("div", { className: "st_grid" }, custom.map((c) => h(ThemeCard, { key: c.id, choice: c, active: state.theme.active === c.id, onPick: () => pick(c.id) }))))
			: null,
	];
}

function ColorRow({ label, value, onChange, badge }) {
	const [text, setText] = useState(value);
	useEffect(() => setText(value), [value]);
	const commitText = (t) => {
		const hex = normHex(t);
		if (hex) onChange(hex);
		else setText(value);
	};
	return h("div", { className: "st_color" },
		h("input", { type: "color", value, onChange: (e) => onChange(e.target.value), "aria-label": label }),
		h("span", { className: "st_label" }, label),
		badge ?? null,
		h("input", {
			className: "st_input", value: text, spellCheck: false,
			onChange: (e) => setText(e.target.value),
			onBlur: (e) => commitText(e.target.value),
			onKeyDown: (e) => { if (e.key === "Enter") commitText(e.currentTarget.value); },
		}),
	);
}

function draftFrom(state, choiceId) {
	const choice = themeChoices(state).find((c) => c.id === (choiceId ?? state.theme.active)) ?? themeChoices(state)[0];
	const t = choice.theme;
	return {
		id: choice.custom ? t.id : null,
		name: choice.custom ? t.name : `My ${choice.name}`,
		dark: { ...t.dark },
		light: { ...t.light },
	};
}

const SHARE_PREFIX = "dshs1:";
function encodeTheme(t) {
	return SHARE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ n: t.name, d: t.dark, l: t.light }))));
}
function decodeTheme(code) {
	const raw = String(code ?? "").trim();
	if (!raw.startsWith(SHARE_PREFIX)) throw new Error("that isn't a Studio theme code (they start with dshs1:)");
	const obj = JSON.parse(decodeURIComponent(escape(atob(raw.slice(SHARE_PREFIX.length)))));
	const cleaned = sanitizeState({ customThemes: [{ id: "x", name: obj.n, dark: obj.d, light: obj.l }] }).customThemes[0];
	if (!cleaned) throw new Error("the theme code is damaged");
	return cleaned;
}

function EditorTab() {
	const state = useSnap((s) => s.state);
	const [draft, setDraft] = useState(() => draftFrom(state));
	const [livePreview, setLivePreview] = useState(true);
	const [shareBox, setShareBox] = useState(null);

	useEffect(() => {
		setSnap({ preview: livePreview ? { theme: draft } : undefined });
	}, [draft, livePreview]);
	useEffect(() => () => setSnap({ preview: undefined }), []);

	const setColor = (mode, key, hex) => setDraft((d) => ({ ...d, [mode]: { ...d[mode], [key]: hex } }));

	const save = (asNew) => {
		const id = !asNew && draft.id ? draft.id : newId("c");
		const entry = { id, name: draft.name.trim() || "My theme", dark: draft.dark, light: draft.light };
		const others = state.customThemes.filter((c) => c.id !== id);
		const existingIndex = state.customThemes.findIndex((c) => c.id === id);
		const next = existingIndex >= 0 ? state.customThemes.map((c) => (c.id === id ? entry : c)) : [...others, entry];
		setDraft({ ...draft, id, name: entry.name });
		update({ customThemes: next, theme: { active: "custom:" + id } });
		toast(`Saved and applied “${entry.name}”`);
	};

	const remove = () => {
		if (!draft.id) return;
		const next = state.customThemes.filter((c) => c.id !== draft.id);
		update({ customThemes: next, ...(state.theme.active === "custom:" + draft.id ? { theme: { active: "default" } } : {}) });
		setDraft(draftFrom({ ...state, customThemes: next, theme: { ...state.theme, active: "default" } }, "default"));
		toast("Theme deleted");
	};

	const importCode = () => {
		try {
			const t = decodeTheme(shareBox ?? "");
			setDraft({ id: null, name: t.name, dark: t.dark, light: t.light });
			setShareBox(null);
			toast(`Imported “${t.name}” — save it to keep it`);
		} catch (e) {
			toast(errorText(e));
		}
	};

	const modeColumn = (mode, title) => {
		const m = draft[mode];
		return h("div", { className: "st_modeCol", style: { background: m.bg, color: m.fg } },
			h("div", { className: "st_modeTitle" }, title),
			h("div", { className: "st_bigMock" }, h(Mock, { m })),
			h("div", { style: { background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", borderRadius: "var(--dsw-radius-sm)", padding: 10, display: "flex", flexDirection: "column", gap: 8 } },
				h(ColorRow, { label: "Background", value: m.bg, onChange: (v) => setColor(mode, "bg", v) }),
				h(ColorRow, { label: "Text", value: m.fg, onChange: (v) => setColor(mode, "fg", v), badge: h(ContrastBadge, { fg: m.fg, bg: m.bg, min: 7, label: "Text" }) }),
				h(ColorRow, { label: "Accent", value: m.accent, onChange: (v) => setColor(mode, "accent", v), badge: h(ContrastBadge, { fg: m.accent, bg: m.bg, min: 3, label: "Accent" }) }),
			),
		);
	};

	return [
		h(Section, {
			key: "pick",
			title: "Theme editor",
			description: "Pick three colours per mode — the editor derives every surface, border and text shade from them, keeping text readable.",
		},
			h("div", { className: "st_row" },
				h(Field, { label: "Start from" },
					h(Select, {
						value: "",
						options: [{ id: "", label: "Choose a theme to copy…" }, ...themeChoices(state).map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))],
						onChange: (id) => { if (id) setDraft(draftFrom(state, id)); },
					})),
				h(Field, { label: "Name" },
					h("input", { className: "st_input", value: draft.name, maxLength: 80, onChange: (e) => setDraft({ ...draft, name: e.target.value }) })),
			),
			h(Toggle, { checked: livePreview, onChange: setLivePreview, label: "Preview across the whole app while editing", hint: "Leaving this tab without saving puts your current theme back." }),
		),
		h("div", { key: "cols", className: "st_editorGrid" }, modeColumn("dark", "🌙 Dark"), modeColumn("light", "☀️ Light")),
		h(Section, { key: "save", title: draft.id ? `Editing “${draft.name}”` : "New theme" },
			h("div", { className: "st_actions" },
				h(Button, { kind: "primary", onClick: () => save(false) }, draft.id ? "Save changes" : "Save & apply"),
				draft.id ? h(Button, { onClick: () => save(true) }, "Save as a copy") : null,
				h(Button, { onClick: () => { const t = randomTheme(); setDraft({ id: draft.id, name: draft.name, dark: t.dark, light: t.light }); } }, "🎲 Randomise colours"),
				h(Button, { onClick: () => { const code = encodeTheme(draft); copyText(code); setShareBox(code); toast("Theme code copied"); } }, "Share code"),
				h(Button, { onClick: () => setShareBox(shareBox == null ? "" : null) }, "Import code"),
				draft.id ? h(Button, { kind: "danger", onClick: remove }, "Delete") : null,
			),
			shareBox != null
				? h("div", { className: "st_row" },
					h(Field, { label: "Theme code", hint: "Paste a code someone shared with you, or copy yours to share." },
						h("input", { className: "st_input st_mono", value: shareBox, onChange: (e) => setShareBox(e.target.value) })),
					h(Button, { onClick: importCode }, "Load code"))
				: null,
		),
	];
}

function StyleTab() {
	const state = useSnap((s) => s.state);
	const env = useSnap((s) => s.env);
	const st = state.style;
	const wall = state.wallpaper;
	const set = (patch) => update({ style: patch });
	const uploadWallpaper = async () => {
		const file = await pickFile("image/*");
		if (!file) return;
		try {
			const src = await imageFileToDataUrl(file, 2400, "image/jpeg", 0.86);
			update({ wallpaper: { src } });
			toast("Wallpaper set");
		} catch (e) {
			toast(errorText(e));
		}
	};
	return [
		h(Section, { key: "type", title: "Typography" },
			h("div", { className: "st_row" },
				h(Field, {
					label: "Interface font",
					hint: st.uiFont === "custom"
						? "Any CSS font-family list, e.g. \"Satoshi\", sans-serif — the font must be installed."
						: st.uiFont === "folder"
							? (env.fontFaces.length ? `Serving ${env.fontFaces.length} font file(s): ${env.fontFaces.map((f) => f.weight).join(", ")} weights.` : "No .otf/.ttf/.woff2 files found there yet.")
							: "Fonts fall back gracefully if one isn't installed.",
				},
					h(Select, { value: st.uiFont, options: UI_FONTS, onChange: (v) => set({ uiFont: v }) }),
					st.uiFont === "custom" ? h(TextInput, { value: st.uiFontCustom, placeholder: "\"My Font\", sans-serif", onCommit: (v) => set({ uiFontCustom: v }) }) : null,
					st.uiFont === "folder" ? h(TextInput, { value: st.fontDir, mono: true, placeholder: "C:\\path\\to\\fonts — files there are served to this app only", onCommit: (v) => set({ fontDir: v }) }) : null),
				h(Field, { label: "Code font" },
					h(Select, { value: st.codeFont, options: CODE_FONTS, onChange: (v) => set({ codeFont: v }) }),
					st.codeFont === "custom" ? h(TextInput, { value: st.codeFontCustom, placeholder: "\"Iosevka\", monospace", onCommit: (v) => set({ codeFontCustom: v }) }) : null),
			),
		),
		h(Section, { key: "shape", title: "Shape & colour details" },
			h("div", { className: "st_row" },
				h(Field, { label: "Corners", narrow: true, group: true }, h(Segmented, { label: "Corners", value: st.radius, options: RADII, onChange: (v) => set({ radius: v }) })),
			),
			h(Toggle, { checked: st.accentBubbles, onChange: (v) => set({ accentBubbles: v }), label: "Accent-tinted chat bubbles", hint: "Your messages pick up the theme's accent colour." }),
			h(Toggle, { checked: st.accentSelection, onChange: (v) => set({ accentSelection: v }), label: "Accent text selection", hint: "Highlighted text uses the accent colour." }),
		),
		h(Section, { key: "material", title: "Material", description: "Liquid glass turns the sidebar, composer, cards, bubbles and menus into frosted, see-through panes. Best over a wallpaper." },
			h(Segmented, { label: "Material", value: st.material, options: MATERIALS, onChange: (v) => set({ material: v }) }),
			st.material === "glass"
				? [
					h("div", { key: "sliders", className: "st_row" },
						h(Slider, { label: "Blur", value: st.glassBlur, min: 0, max: 60, format: (v) => v + "px", onChange: (v) => set({ glassBlur: v }) }),
						h(Slider, { label: "Glass opacity", value: st.glassOpacity, min: 5, max: 95, format: (v) => v + "%", onChange: (v) => set({ glassOpacity: v }) })),
					h(Toggle, { key: "sheen", checked: st.glassSheen, onChange: (v) => set({ glassSheen: v }), label: "Specular edge and sheen", hint: "A bright top rim and a soft diagonal reflection on every pane." }),
					h("span", { key: "count", className: "st_hint" }, state.cache.glassSelectors.length
						? `${state.cache.glassSelectors.length} glass surfaces found in this harness version.`
						: "Finding the harness's surfaces… (menus are glass already)"),
				]
				: null,
		),
		h(Section, { key: "fx", title: "Ambience", description: "A subtle full-screen effect layered over the app. It never blocks clicks." },
			h(Segmented, { label: "Ambience", value: st.ambience, options: AMBIENCES, onChange: (v) => set({ ambience: v }) }),
			st.ambience !== "none"
				? h("div", { className: "st_row" },
					h(Slider, { label: "Strength", value: st.ambienceStrength, min: 5, max: 100, step: 5, format: (v) => v + "%", onChange: (v) => set({ ambienceStrength: v }) }),
					st.ambience === "aurora" ? h(Toggle, { checked: st.animate, onChange: (v) => set({ animate: v }), label: "Slow drift animation", hint: "Respects your system's reduced-motion setting." }) : null)
				: null,
		),
		h(Section, {
			key: "wall",
			title: "Wallpaper",
			description: "An image behind the conversation. Surfaces turn translucent so it shows through.",
			actions: h("div", { className: "st_actions" },
				env.desktopWallpaper ? h(Button, { onClick: () => update({ wallpaper: { src: DESKTOP_WALLPAPER } }) }, "🖥️ Use my desktop wallpaper") : null,
				h(Button, { onClick: uploadWallpaper }, "Upload image…"),
				wall.src ? h(Button, { kind: "danger", onClick: () => update({ wallpaper: { src: "" } }) }, "Remove") : null),
		},
			h("div", { className: "st_row", style: { alignItems: "center" } },
				wall.src ? h("div", { className: "st_wallThumb", style: { backgroundImage: `url("${(wall.src === DESKTOP_WALLPAPER ? DESKTOP_WALLPAPER_URL : wall.src).replace(/"/g, "")}")` } }) : null,
				wall.src === DESKTOP_WALLPAPER
					? h("span", { className: "st_hint", style: { flex: 1 } }, "Following your Windows desktop wallpaper — change it in Windows and Studio picks it up on the next reload.")
					: h(Field, { label: "…or an image URL", hint: "https:// links work; uploads are resized and stored in your settings file." },
						h(TextInput, { value: wall.src.startsWith("data:") ? "" : wall.src, placeholder: "https://…", onCommit: (v) => update({ wallpaper: { src: v.trim() } }) })),
			),
			wall.src
				? h("div", { className: "st_row" },
					h(Slider, { label: "Visibility", value: wall.strength, min: 5, max: 80, format: (v) => v + "%", onChange: (v) => update({ wallpaper: { strength: v } }) }),
					h(Slider, { label: "Blur", value: wall.blur, min: 0, max: 40, format: (v) => v + "px", onChange: (v) => update({ wallpaper: { blur: v } }) }))
				: null,
		),
	];
}

/** The harness's own whale mark (from its favicon), drawn in the current text colour. */
function DeepSeekLogo({ size = 24 }) {
	return h("svg", { width: size, height: size, viewBox: "0 0 50 50", fill: "currentColor", "aria-label": "DeepSeek logo", role: "img" },
		h("path", { d: "M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z" }));
}

function MarkPreview({ identity, size }) {
	if (identity.mark === "emoji") {
		return h("span", { className: "st_markEmoji", style: { width: size, height: size, fontSize: Math.round(size * 0.82) } }, identity.markEmoji || "✨");
	}
	if (identity.mark === "monogram") {
		const text = (identity.markText || initialsOf(identity.name || identity.appName) || "✦").slice(0, 3);
		return h("span", { className: "st_markMono", style: { width: size, height: size, fontSize: Math.round(size * (text.length > 1 ? 0.42 : 0.56)) } }, text);
	}
	if (identity.mark === "image" && identity.markImage) {
		return h("img", { className: "st_markImg", src: identity.markImage, width: size, height: size, alt: "" });
	}
	return h(DeepSeekLogo, { size });
}

function initialsOf(name) {
	return String(name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function IdentityTab() {
	const state = useSnap((s) => s.state);
	const id = state.identity;
	const set = (patch) => update({ identity: patch });
	// The logo only switches to "Image" once a file is actually chosen; cancelling changes nothing.
	const uploadMark = async () => {
		const file = await pickFile("image/*");
		if (!file) return;
		try {
			const src = await imageFileToDataUrl(file, 128, "image/png");
			set({ mark: "image", markImage: src });
		} catch (e) {
			toast(errorText(e));
		}
	};
	const removeMarkImage = () => {
		set({ mark: "default", markImage: "" });
		toast("Image removed — back to the DeepSeek logo");
	};
	const pickMark = (mark) => {
		if (mark === "image" && !id.markImage) void uploadMark();
		else set({ mark });
	};
	return [
		h(Section, { key: "you", title: "You", description: "Used by the greeting and, if you turn it on, by the AI's personal preferences." },
			h("div", { className: "st_row" },
				h(Field, { label: "Your name" }, h(TextInput, { value: id.name, placeholder: "What should it call you?", maxLength: 80, onCommit: (v) => set({ name: v }) })),
			),
		),
		h(Section, { key: "brand", title: "Make it yours", description: "Rename the app and swap the logo in the sidebar and on the new-chat screen. Leave blank to keep the originals." },
			h("div", { className: "st_row" },
				h(Field, { label: "App name (sidebar)" }, h(TextInput, { value: id.appName, placeholder: "e.g. My Lab", maxLength: 80, onCommit: (v) => set({ appName: v }) })),
				h(Field, { label: "Logo", narrow: true, group: true },
					h(Segmented, { label: "Logo", value: id.mark, options: [{ id: "default", label: "Original" }, { id: "emoji", label: "Emoji" }, { id: "monogram", label: "Monogram" }, { id: "image", label: "Image" }], onChange: pickMark })),
			),
			id.mark === "emoji" ? h(Field, { label: "Emoji", narrow: true }, h(TextInput, { value: id.markEmoji, maxLength: 16, onCommit: (v) => set({ markEmoji: v }) })) : null,
			id.mark === "monogram" ? h(Field, { label: "Letters (1–3)", narrow: true, hint: "Blank uses your initials." }, h(TextInput, { value: id.markText, maxLength: 3, onCommit: (v) => set({ markText: v }) })) : null,
			id.mark === "image" && id.markImage
				? h("div", { className: "st_row", style: { alignItems: "center", gap: 14 } },
					h("div", { className: "st_markThumb" },
						h("img", { src: id.markImage, alt: "Your logo image" }),
						h("button", {
							type: "button", className: "st_markRemove", onClick: removeMarkImage,
							title: "Remove this image and use the DeepSeek logo", "aria-label": "Remove image and use the DeepSeek logo",
						}, "×")),
					h(Button, { onClick: uploadMark }, "Choose a different image…"))
				: null,
			h("div", { className: "st_identityPreview" },
				h(MarkPreview, { identity: id, size: 24 }),
				h("span", { className: "st_brandName" }, id.appName || "DeepSeek Harness"),
			),
		),
		h(Section, { key: "greet", title: "Greeting", description: "Replaces the headline on the new-chat screen." },
			h(Toggle, { checked: id.greeting, onChange: (v) => set({ greeting: v }), label: "Show a personal greeting" }),
			id.greeting
				? [
					h(Field, { key: "tpl", label: "Template", hint: "Placeholders: {name}, {timeOfDay} (morning / afternoon / evening / night), {day}." },
						h(TextInput, { value: id.greetingTemplate, maxLength: 160, onCommit: (v) => set({ greetingTemplate: v }) })),
					h("div", { key: "pv", className: "st_greetPreview" }, renderGreeting(state)),
				]
				: null,
			h(Toggle, { checked: id.hideBadge, onChange: (v) => set({ hideBadge: v }), label: "Hide the “Preview” badge" }),
		),
	];
}

function PersonaTab() {
	const state = useSnap((s) => s.state);
	const p = state.persona;
	const set = (patch) => update({ persona: patch });
	const preview = personaPrompt({ ...state, persona: { ...p, enabled: true } });
	const style = RESPONSE_STYLES.find((s) => s.id === p.style);
	return [
		h(Section, { key: "on", title: "Personal preferences for the AI", description: "Like custom instructions: Studio adds a short section to the system prompt for every agent turn." },
			h(Toggle, { checked: p.enabled, onChange: (v) => set({ enabled: v }), label: "Send my preferences to the model", hint: "Applies from the next message. Changing them makes the model re-read its whole prompt once (a cache miss), so tweak, then leave it." }),
		),
		h(Section, { key: "fields", title: "What it should know" },
			h(Field, { label: "About you", hint: "Your role, what you're working on, your experience level…" },
				h(TextArea, { value: p.aboutMe, rows: 3, placeholder: "e.g. I'm a backend developer; comfortable with JS, newer to Rust.", onCommit: (v) => set({ aboutMe: v }) })),
			h("div", { className: "st_row" },
				h(Field, { label: "Response style", hint: style?.text || "No extra style guidance." },
					h(Select, { value: p.style, options: RESPONSE_STYLES, onChange: (v) => set({ style: v }) })),
				h(Field, { label: "Reply language", hint: "e.g. British English. Blank = whatever you write in." },
					h(TextInput, { value: p.language, placeholder: "British English", maxLength: 80, onCommit: (v) => set({ language: v }) })),
			),
			h(Field, { label: "Custom instructions", hint: "Anything else, in your own words." },
				h(TextArea, { value: p.instructions, rows: 5, placeholder: "e.g. Always show the full file when you change one. Prefer pnpm. Don't add comments unless asked.", onCommit: (v) => set({ instructions: v }) })),
		),
		h(Section, { key: "preview", title: "Exactly what the model sees", description: p.enabled ? "This section is live." : "Off — nothing is sent until you turn it on." },
			h("pre", { className: "st_pre" }, preview || "(nothing yet — fill in a field above)")),
	];
}

function PromptsTab() {
	const prompts = useSnap((s) => s.state.prompts);
	const [editing, setEditing] = useState(null);
	const save = () => {
		const title = editing.title.trim() || "Untitled";
		const entry = { id: editing.id ?? newId("p"), title, text: editing.text };
		const exists = prompts.some((p) => p.id === entry.id);
		update({ prompts: exists ? prompts.map((p) => (p.id === entry.id ? entry : p)) : [...prompts, entry] });
		setEditing(null);
		toast(exists ? "Prompt updated" : "Prompt added");
	};
	const move = (index, delta) => {
		const next = [...prompts];
		const [item] = next.splice(index, 1);
		next.splice(index + delta, 0, item);
		update({ prompts: next });
	};
	return [
		h(Section, {
			key: "list",
			title: "Saved prompts",
			description: "Insert one with the ✦ button beside the composer, by typing /prompts, or from Ctrl+K.",
			actions: h(Button, { kind: "primary", onClick: () => setEditing({ id: null, title: "", text: "" }) }, "+ New prompt"),
		},
			editing
				? h("div", { className: "st_section", style: { background: "var(--dsw-alias-bg-layer-2)" } },
					h(Field, { label: "Title" }, h("input", { className: "st_input", value: editing.title, maxLength: 80, autoFocus: true, onChange: (e) => setEditing({ ...editing, title: e.target.value }) })),
					h(Field, { label: "Prompt text", hint: "Inserted at your cursor. End with a blank line to leave room for what you paste after it." },
						h("textarea", { className: "st_input", rows: 6, value: editing.text, onChange: (e) => setEditing({ ...editing, text: e.target.value }) })),
					h("div", { className: "st_actions" },
						h(Button, { kind: "primary", onClick: save, disabled: !editing.text.trim() }, "Save"),
						h(Button, { onClick: () => setEditing(null) }, "Cancel")))
				: null,
			prompts.length === 0
				? h("p", { className: "st_hint" }, "No saved prompts yet.")
				: h("div", null, prompts.map((p, i) => h("div", { key: p.id, className: "st_promptRow" },
					h("div", { className: "st_promptBody" },
						h("div", { className: "st_promptTitle" }, p.title),
						h("div", { className: "st_promptText" }, p.text.replace(/\s+/g, " "))),
					h("div", { className: "st_actions" },
						h(Button, { small: true, disabled: i === 0, onClick: () => move(i, -1), "aria-label": "Move up" }, "↑"),
						h(Button, { small: true, disabled: i === prompts.length - 1, onClick: () => move(i, 1), "aria-label": "Move down" }, "↓"),
						h(Button, { small: true, onClick: () => insertPrompt(p) }, "Insert"),
						h(Button, { small: true, onClick: () => setEditing({ ...p }) }, "Edit"),
						h(Button, { small: true, kind: "danger", onClick: () => update({ prompts: prompts.filter((x) => x.id !== p.id) }) }, "Delete"))))),
		),
	];
}

function AdvancedTab() {
	const state = useSnap((s) => s.state);
	const [confirmReset, setConfirmReset] = useState(false);
	const exportJson = () => {
		const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "dsh-studio-settings.json";
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	};
	const importJson = async () => {
		const file = await pickFile("application/json,.json");
		if (!file) return;
		try {
			await replaceState(sanitizeState(JSON.parse(await file.text())));
			toast("Settings imported");
		} catch (e) {
			toast("Import failed: " + errorText(e));
		}
	};
	const reset = async () => {
		if (!confirmReset) { setConfirmReset(true); return; }
		try {
			await resetState();
			setConfirmReset(false);
			toast("Studio reset to defaults");
		} catch (e) {
			toast(errorText(e));
		}
	};
	return [
		h(Section, { key: "css", title: "Custom CSS", description: "Applied last, on top of everything. Use the --dsw-* design tokens to stay theme-aware." },
			h(TextArea, { value: state.customCss, rows: 10, mono: true, placeholder: "/* e.g. make the composer pop */\n[class*=\"_composer\"] { box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary); }", onCommit: (v) => update({ customCss: v }) })),
		h(Section, { key: "io", title: "Backup", description: "Everything Studio stores lives in ~/.dsh/studio/studio.json." },
			h("div", { className: "st_actions" },
				h(Button, { onClick: exportJson }, "Export settings…"),
				h(Button, { onClick: importJson }, "Import settings…"),
				h(Button, { kind: "danger", onClick: () => void reset() }, confirmReset ? "Click again to reset everything" : "Reset to defaults"))),
	];
}

const TABS = [
	{ id: "themes", label: "Themes", component: ThemesTab },
	{ id: "editor", label: "Theme editor", component: EditorTab },
	{ id: "style", label: "Style", component: StyleTab },
	{ id: "identity", label: "Identity", component: IdentityTab },
	{ id: "persona", label: "AI preferences", component: PersonaTab },
	{ id: "prompts", label: "Prompts", component: PromptsTab },
	{ id: "advanced", label: "Advanced", component: AdvancedTab },
];

function StudioPage() {
	const loaded = useSnap((s) => s.loaded);
	const error = useSnap((s) => s.error);
	const tab = useSnap((s) => s.tab);
	const current = TABS.find((t) => t.id === tab) ?? TABS[0];
	return h("div", { className: "st_page" },
		h("div", { className: "st_inner" },
			h("div", { className: "st_head" },
				h("div", null,
					h("h1", { className: "st_title" }, h("span", { className: "st_titleMark" }, h(PaletteIcon, { size: 18 })), "Studio"),
					h("p", { className: "st_sub" }, "Themes, style and personal touches for your harness. ", h("span", { className: "st_kbd" }, "Ctrl K"), " opens the quick switcher anywhere."),
				),
			),
			h("div", { className: "st_tabs", role: "tablist" },
				TABS.map((t) => h("button", { key: t.id, type: "button", role: "tab", className: "st_tab", "aria-selected": t.id === current.id, onClick: () => setSnap({ tab: t.id }) }, t.label))),
			error ? h("div", { className: "st_banner" }, error) : null,
			loaded ? h(current.component, { key: current.id }) : h("p", { className: "st_hint" }, "Loading your Studio…"),
		),
	);
}
//#endregion

//#region command palette (Ctrl+K)
function paletteItems(state) {
	const items = [];
	for (const c of themeChoices(state)) {
		items.push({
			id: "theme:" + c.id, group: "Themes", icon: c.emoji, label: c.name,
			hint: state.theme.active === c.id ? "current" : "",
			preview: { theme: c.id === "default" ? null : c.theme },
			run: () => applyTheme(c.id),
		});
	}
	items.push({ id: "surprise", group: "Themes", icon: "🎲", label: "Surprise me", hint: "random theme", run: surprise });
	for (const look of LOOKS) items.push({ id: "look:" + look.id, group: "Looks", icon: "🫧", label: look.name, hint: "theme + glass + wallpaper", run: () => applyLook(look) });
	items.push({
		id: "material", group: "Looks", icon: state.style.material === "glass" ? "▢" : "🫧",
		label: state.style.material === "glass" ? "Switch to solid panels" : "Switch to liquid glass panels",
		run: () => { update({ style: { material: state.style.material === "glass" ? "solid" : "glass" } }); toast(state.style.material === "glass" ? "Solid panels" : "Liquid glass"); },
	});
	if (services.theme) {
		items.push({ id: "mode:light", group: "Appearance", icon: "☀️", label: "Light mode", run: () => setAppearance("light") });
		items.push({ id: "mode:dark", group: "Appearance", icon: "🌙", label: "Dark mode", run: () => setAppearance("dark") });
		items.push({ id: "mode:system", group: "Appearance", icon: "💻", label: "Match system", run: () => setAppearance("system") });
		items.push({ id: "font:+", group: "Appearance", icon: "🔠", label: "Larger chat text", run: () => bumpFontSize(1) });
		items.push({ id: "font:-", group: "Appearance", icon: "🔡", label: "Smaller chat text", run: () => bumpFontSize(-1) });
	}
	for (const a of AMBIENCES) {
		items.push({
			id: "fx:" + a.id, group: "Ambience", icon: "✨", label: a.label, hint: state.style.ambience === a.id ? "current" : "",
			run: () => { update({ style: { ambience: a.id } }); toast("Ambience: " + a.label); },
		});
	}
	for (const p of state.prompts) items.push({ id: "prompt:" + p.id, group: "Insert prompt", icon: "✦", label: p.title, run: () => insertPrompt(p) });
	items.push({
		id: "persona", group: "AI", icon: "🧠",
		label: state.persona.enabled ? "Stop sending my preferences to the model" : "Send my preferences to the model",
		run: () => { update({ persona: { enabled: !state.persona.enabled } }); toast(state.persona.enabled ? "Preferences off" : "Preferences on"); },
	});
	if (services.layout) items.push({ id: "sidebar", group: "Layout", icon: "◧", label: "Toggle sidebar", run: () => services.layout.toggleSidebar() });
	for (const t of TABS) items.push({ id: "open:" + t.id, group: "Studio", icon: "🎨", label: "Open " + t.label, run: () => openStudio(t.id) });
	return items;
}

function fuzzyScore(text, query) {
	let from = 0;
	let score = 0;
	let streak = 0;
	for (const ch of query) {
		const at = text.indexOf(ch, from);
		if (at === -1) return -1;
		streak = at === from ? streak + 1 : 0;
		score += 1 + streak * 2 + (at === 0 || text[at - 1] === " " ? 3 : 0);
		from = at + 1;
	}
	return score - text.length * 0.01;
}

function filterItems(items, query) {
	const q = query.trim().toLowerCase();
	if (!q) return items;
	return items
		.map((item) => ({ item, score: fuzzyScore(`${item.label} ${item.group}`.toLowerCase(), q) }))
		.filter((x) => x.score >= 0)
		.sort((a, b) => b.score - a.score)
		.map((x) => x.item);
}

function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [index, setIndex] = useState(0);
	const state = useSnap((s) => s.state);
	const toastText = useSnap((s) => s.toast);
	const inputRef = useRef(null);
	const listRef = useRef(null);
	/** Whatever preview was showing before the palette opened (e.g. the theme editor's draft). */
	const previewBefore = useRef(undefined);

	useEffect(() => {
		const onKey = (e) => {
			if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyK") {
				e.preventDefault();
				e.stopPropagation();
				setOpen((o) => !o);
			}
		};
		const onOpen = () => setOpen(true);
		window.addEventListener("keydown", onKey, true);
		window.addEventListener("dsh-studio:palette", onOpen);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			window.removeEventListener("dsh-studio:palette", onOpen);
		};
	}, []);

	useEffect(() => {
		if (!open) {
			if (snapshot.preview !== previewBefore.current) setSnap({ preview: previewBefore.current });
			return;
		}
		previewBefore.current = snapshot.preview;
		setQuery("");
		// Start on the current theme so opening the palette doesn't change the look.
		const current = paletteItems(snapshot.state).findIndex((item) => item.id === "theme:" + snapshot.state.theme.active);
		setIndex(Math.max(0, current));
	}, [open]);

	const items = useMemo(() => (open ? paletteItems(state) : []), [open, state]);
	const filtered = useMemo(() => filterItems(items, query), [items, query]);
	const active = filtered[Math.min(index, filtered.length - 1)];

	// Arrowing through themes previews them live; closing without choosing puts yours back.
	useEffect(() => {
		if (!open) return;
		setSnap({ preview: active?.preview ?? previewBefore.current });
	}, [open, active]);

	useEffect(() => {
		listRef.current?.querySelector("[data-active=true]")?.scrollIntoView({ block: "nearest" });
	}, [index, query]);

	const run = (item) => {
		if (!item) return;
		setOpen(false);
		setSnap({ preview: previewBefore.current });
		try { item.run(); } catch (e) { toast(errorText(e)); }
	};

	const onKeyDown = (e) => {
		if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(filtered.length - 1, i + 1)); }
		else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
		else if (e.key === "Enter") { e.preventDefault(); run(active); }
		else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
	};

	const rows = [];
	let lastGroup = null;
	filtered.forEach((item, i) => {
		if (item.group !== lastGroup) {
			lastGroup = item.group;
			rows.push(h("div", { key: "g:" + item.group + i, className: "st_paletteGroup" }, item.group));
		}
		rows.push(h("button", {
			key: item.id, type: "button", className: "st_paletteItem", role: "option",
			"data-active": String(item === active), "aria-selected": item === active,
			onMouseMove: () => { if (item !== active) setIndex(i); },
			onClick: () => run(item),
		},
			h("span", { className: "st_paletteIcon", "aria-hidden": true }, item.icon),
			h("span", { className: "st_paletteLabel" }, item.label),
			item.hint ? h("span", { className: "st_paletteHint" }, item.hint) : null));
	});

	return [
		open
			? h("div", { key: "palette", className: "st_backdrop", onMouseDown: (e) => { if (e.target === e.currentTarget) setOpen(false); } },
				h("div", { className: "st_palette", role: "dialog", "aria-label": "Studio quick switcher" },
					h("input", {
						// autoFocus focuses during mount, so keys typed straight after Ctrl+K are not lost.
						ref: inputRef, autoFocus: true, className: "st_paletteInput", value: query, placeholder: "Search themes, prompts, settings…",
						role: "combobox", "aria-expanded": true, onKeyDown,
						onChange: (e) => { setQuery(e.target.value); setIndex(0); },
					}),
					h("div", { ref: listRef, className: "st_paletteList", role: "listbox" }, rows.length ? rows : h("div", { className: "st_paletteEmpty" }, "Nothing matches")),
					h("div", { className: "st_paletteFoot" }, h("span", null, "↑↓ browse (themes preview live)"), h("span", null, "↵ apply"), h("span", null, "esc close"))))
			: null,
		toastText ? h("div", { key: "toast", className: "st_toast", role: "status" }, toastText) : null,
	];
}
//#endregion

//#region composer button
function PromptsButton({ sessionId, inputActions, useInput }) {
	const draft = typeof useInput === "function" ? useInput((s) => (s && typeof s.draft === "string" ? s.draft : "")) : "";
	const draftRef = useRef(draft);
	draftRef.current = draft;
	const prompts = useSnap((s) => s.state.prompts);
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);

	useEffect(() => {
		if (!sessionId || !inputActions) return;
		const entry = { actions: inputActions, getDraft: () => draftRef.current };
		composers.set(sessionId, entry);
		lastComposer = sessionId;
		return () => {
			if (composers.get(sessionId) === entry) composers.delete(sessionId);
			if (lastComposer === sessionId) lastComposer = [...composers.keys()].pop() ?? null;
		};
	}, [sessionId, inputActions]);

	useEffect(() => {
		if (!open) return;
		const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
		const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	if (!inputActions) return null;
	return h("div", { className: "st_cbWrap", ref: rootRef },
		h("button", {
			type: "button", className: "st_cbBtn", title: "Saved prompts", "aria-label": "Saved prompts", "aria-expanded": open,
			onClick: () => { lastComposer = sessionId; setOpen((o) => !o); },
		}, h(SparkIcon, { size: 16 })),
		open
			? h("div", { className: "st_cbMenu", role: "menu" },
				h("div", { className: "st_cbHead" }, "Saved prompts"),
				prompts.length === 0 ? h("div", { className: "st_hint", style: { padding: "6px 10px" } }, "None yet.") : null,
				prompts.map((p) => h("button", {
					key: p.id, type: "button", role: "menuitem", className: "st_cbItem",
					onClick: () => { insertPrompt(p, sessionId); setOpen(false); },
				}, h("span", { className: "st_cbItemTitle" }, p.title), h("span", { className: "st_cbItemText" }, p.text.replace(/\s+/g, " ")))),
				h("button", { type: "button", className: "st_cbManage", onClick: () => { setOpen(false); openStudio("prompts"); } }, "Manage prompts…"))
			: null,
	);
}
//#endregion

//#region brand occupants
function BrandName() {
	const appName = useSnap((s) => s.state.identity.appName);
	return h("span", { className: "st_brandName", title: appName }, appName);
}

function BrandMark({ size, className }) {
	const identity = useSnap((s) => s.state.identity);
	const mark = h(MarkPreview, { identity, size: size ?? 24 });
	return className ? h("span", { className, style: { display: "inline-flex" } }, mark) : mark;
}

/** Occupy the brand slots (shadowing the originals) only while the user has set something. */
function installBrandSync(ctx) {
	let offName = null;
	let offMarks = null;
	let prev = { name: false, mark: false };
	const sync = () => {
		const id = snapshot.state.identity;
		const want = {
			name: snapshot.loaded && id.appName.trim().length > 0,
			mark: snapshot.loaded && (id.mark === "emoji" || id.mark === "monogram" || (id.mark === "image" && Boolean(id.markImage))),
		};
		if (want.name !== prev.name) {
			offName?.();
			offName = want.name
				? ctx.slots.inject("sidebar.brand.name", () => ctx.slots.register({ name: "sidebar.brand.name", priority: -10 }, BrandName))
				: null;
		}
		if (want.mark !== prev.mark) {
			offMarks?.();
			if (want.mark) {
				const a = ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.register({ name: "sidebar.brand.mark", priority: -10 }, BrandMark));
				const b = ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -10 }, BrandMark));
				offMarks = () => { a(); b(); };
			} else {
				offMarks = null;
			}
		}
		prev = want;
	};
	ctx.effect(() => {
		sync();
		const off = subscribe(sync);
		return () => {
			off();
			offName?.();
			offMarks?.();
			offName = offMarks = null;
			prev = { name: false, mark: false };
		};
	}, "dsh-studio: brand occupants");
}
//#endregion

//#region slash commands
function registerCommands(scope) {
	const commands = scope.commandUi;
	scope.effect(() => commands.register({
		name: "theme",
		label: () => "Theme",
		description: () => "Switch your Studio theme",
		icon: PaletteIcon,
		available: () => true,
		ui: {
			kind: "popupSelect",
			searchMode: "fuzzy-label",
			searchLabels: () => ({ placeholder: "Search themes", empty: "No themes", noResults: "No matching theme" }),
			options: async () => [
				...themeChoices(snapshot.state).map((c) => ({
					id: c.id, label: `${c.emoji}  ${c.name}`, detail: c.description,
					active: snapshot.state.theme.active === c.id,
					group: { name: c.custom ? "custom" : "builtin", label: c.custom ? "Your themes" : "Themes" },
				})),
				{ id: "__surprise", label: "🎲  Surprise me", detail: "A random theme", group: { name: "more", label: "More" } },
			],
			onSelect: (option) => { if (option.id === "__surprise") surprise(); else applyTheme(option.id); },
		},
	}), "dsh-studio: /theme");

	scope.effect(() => commands.register({
		name: "prompts",
		label: () => "Saved prompts",
		description: () => "Insert one of your Studio prompts",
		icon: SparkIcon,
		available: () => snapshot.state.prompts.length > 0,
		ui: {
			kind: "popupSelect",
			searchMode: "fuzzy-label",
			searchLabels: () => ({ placeholder: "Search prompts", empty: "No saved prompts", noResults: "No matching prompt" }),
			options: async () => snapshot.state.prompts.map((p) => ({ id: p.id, label: p.title, detail: p.text.replace(/\s+/g, " ").slice(0, 120) })),
			onSelect: (option, session) => {
				const prompt = snapshot.state.prompts.find((p) => p.id === option.id);
				if (prompt) setTimeout(() => insertPrompt(prompt, session?.sessionId), 0);
			},
		},
	}), "dsh-studio: /prompts");

	scope.effect(() => commands.register({
		name: "studio",
		label: () => "Studio",
		description: () => "Open themes & personalisation",
		icon: PaletteIcon,
		available: () => true,
		ui: { kind: "action", run: () => openStudio() },
	}), "dsh-studio: /studio");
}
//#endregion

//#region plugin entry
/** Required service: the UI slot registry. Everything else is optional and wired when present. */
const inject = ["slots"];

function apply(ctx) {
	ctx.effect(() => {
		const tag = document.createElement("style");
		tag.dataset.plugin = PLUGIN_ID;
		tag.dataset.pluginCss = PLUGIN_ID + "/studio.css";
		tag.textContent = STUDIO_CSS;
		document.head.appendChild(tag);
		return () => tag.remove();
	}, "dsh-studio: ui stylesheet");

	ctx.effect(() => {
		const off = subscribe(applyCss);
		void load().then(applyCss);
		const timer = setInterval(applyCss, 5 * 60 * 1000); // keeps the greeting's time of day current
		return () => {
			off();
			clearInterval(timer);
			if (saveTimer) { clearTimeout(saveTimer); void flushSave(); }
			styleEl?.remove();
			styleEl = null;
			lastCss = "";
		};
	}, "dsh-studio: live theme");

	ctx.effect(() => {
		let timer = null;
		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(syncGlassSelectors, 600);
		};
		let lastKey = "";
		const off = subscribe(() => {
			const key = `${snapshot.loaded}|${snapshot.state.style.material}`;
			if (key !== lastKey) {
				lastKey = key;
				schedule();
			}
		});
		const observer = new MutationObserver(schedule); // plugin stylesheets arrive as modules load
		observer.observe(document.head, { childList: true });
		return () => {
			off();
			observer.disconnect();
			clearTimeout(timer);
		};
	}, "dsh-studio: glass surface discovery");

	ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, StudioPage));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 6, label: "Studio" }, PaletteIcon));
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-studio-palette" }, CommandPalette));
	ctx.slots.inject("conversation.input.left", () => ctx.slots.register({ name: "conversation.input.left", id: "dsh-studio-prompts", order: 90 }, PromptsButton));
	installBrandSync(ctx);

	ctx.inject(["theme"], (scope) => {
		services.theme = scope.theme;
		setSnap({ themeSnap: scope.theme.getTheme() });
		scope.on("theme/change", (snap) => setSnap({ themeSnap: snap }));
		scope.effect(() => () => { services.theme = null; }, "dsh-studio: theme service");
	});
	ctx.inject(["layout"], (scope) => {
		services.layout = scope.layout;
		scope.effect(() => () => { services.layout = null; }, "dsh-studio: layout service");
	});
	ctx.inject(["commandUi"], registerCommands);
}
//#endregion

exports.apply = apply;
exports.inject = inject;
