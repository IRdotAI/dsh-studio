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
			windowsAccent: snapshot.env.windowsAccent,
			greetingLang: greetingLang(),
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
