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

/** Whether Windows / the browser asks for less transparency ("Transparency effects" off). */
const systemReducesTransparency = () => {
	try { return window.matchMedia?.("(prefers-reduced-transparency: reduce)").matches === true; } catch { return false; }
};

/** The settings as currently shown: with the open workspace's own theme or look applied. */
function effectiveState() {
	const s = snapshot.state;
	const target = workspaceTarget(s, snapshot.workspace.id || s.cache.workspace);
	return target ? applyTargetToState(s, target) : s;
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
			workspace: snapshot.workspace.id || undefined,
			slide: slideIndex(snapshot.env.wallpaperCount ?? 0, snapshot.state.wallpaper.interval),
			reduceTransparency: systemReducesTransparency(),
			...(snapshot.preview ? { previewTheme: snapshot.preview.theme } : {}),
		});
	} catch (e) {
		console.warn("dsh-studio: stylesheet build failed", e);
		return;
	}
	syncVideo();
	if (css === lastCss && styleEl?.isConnected) return;
	lastCss = css;
	ensureStyleEl().textContent = css;
}
//#endregion

//#region video wallpaper
let videoEl = null;

/** Keep the looping video wallpaper element in step with the settings (paused while hidden or for reduced motion). */
function syncVideo() {
	const wall = effectiveState().wallpaper;
	const st = snapshot.state.style;
	const want = wall.src === "video" && wall.video && !st.reduceTransparency && !systemReducesTransparency();
	if (!want) {
		videoEl?.remove();
		videoEl = null;
		return;
	}
	const src = /^https?:/i.test(wall.video) ? wall.video : `${VIDEO_WALLPAPER_URL}?v=${encodeURIComponent(wall.video)}`;
	if (!videoEl?.isConnected) {
		videoEl = document.createElement("video");
		videoEl.id = "studio-wall-video";
		videoEl.muted = true;
		videoEl.loop = true;
		videoEl.playsInline = true;
		videoEl.setAttribute("aria-hidden", "true");
		videoEl.setAttribute("tabindex", "-1");
		document.body.prepend(videoEl);
	}
	if (videoEl.dataset.src !== src) {
		videoEl.dataset.src = src;
		videoEl.src = src;
	}
	let still = false;
	try { still = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* no media queries */ }
	if (document.hidden || still) videoEl.pause();
	else void videoEl.play().catch(() => { /* autoplay refused; shows the first frame */ });
}
//#endregion

//#region open workspace
/** The workspace of the chat in the main view, and every workspace, from the harness's workspace service. */
function readWorkspace() {
	const ui = services.uiWorkspace;
	if (!ui) return { id: "", title: "", list: [] };
	let items = [];
	let sessionId;
	try { items = ui.workspaces?.list?.getSnapshot?.()?.items ?? []; } catch { /* not ready */ }
	try { sessionId = ui.selection?.getSnapshot?.()?.sessionId; } catch { /* not ready */ }
	const titleOf = (w) => w.title || String(w.path ?? "").split(/[\\/]/).filter(Boolean).pop() || w.workspaceId;
	const open = sessionId ? items.find((w) => w.sessionIds?.includes(sessionId)) : undefined;
	return {
		id: open?.workspaceId ?? "",
		title: open ? titleOf(open) : "",
		list: items.map((w) => ({ id: w.workspaceId, title: titleOf(w) })),
	};
}

/** A workspace's name as the sidebar shows it: DSH's own "default-workspace" is translated. */
const workspaceLabel = (title) => (title === "default-workspace" ? t("workspaces.default") : title);

/** Follow workspace switches; remember the open one so the host's first paint matches. */
function watchWorkspace() {
	const ui = services.uiWorkspace;
	const persist = () => {
		const id = snapshot.workspace.id;
		if (snapshot.loaded && id && id !== snapshot.state.cache.workspace) update({ cache: { workspace: id } });
	};
	const refresh = () => {
		const next = readWorkspace();
		const cur = snapshot.workspace;
		const same = next.id === cur.id && next.title === cur.title && next.list.length === cur.list.length && next.list.every((w, i) => w.id === cur.list[i]?.id && w.title === cur.list[i]?.title);
		if (!same) setSnap({ workspace: next });
		persist();
	};
	refresh();
	const offs = [];
	try { offs.push(ui.selection.subscribe(refresh)); } catch { /* no selection store */ }
	try { offs.push(ui.workspaces.list.subscribe(refresh)); } catch { /* no list store */ }
	const offLoad = subscribe(persist);
	return () => {
		for (const off of offs) { try { off?.(); } catch { /* already gone */ } }
		offLoad();
	};
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
