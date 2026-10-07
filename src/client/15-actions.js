//#region themes & looks
/** Every selectable theme as { id (state.theme.active value), name, emoji, description, theme }. */
function themeChoices(state) {
	return [
		{ id: "default", name: STOCK_THEME.name, emoji: "🐋", description: tOr("themeDesc.default", "The harness's own palette."), theme: STOCK_THEME },
		...PRESETS.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, description: tOr("themeDesc." + p.id, p.description), theme: p })),
		...state.customThemes.map((c) => ({ id: "custom:" + c.id, name: c.name, emoji: "🎨", description: t("themes.yourTheme"), theme: c, custom: true })),
	];
}

function applyTheme(id, quiet) {
	const choice = themeChoices(snapshot.state).find((c) => c.id === id);
	update({ theme: { active: id } });
	if (choice && !quiet) toast(t("toast.theme", { name: choice.name }));
}

function surprise() {
	const theme = randomTheme();
	const others = snapshot.state.customThemes.filter((c) => c.id !== "surprise");
	update({ customThemes: [...others, { ...theme, name: t("themes.surpriseName", { name: theme.name }) }], theme: { active: "custom:surprise" } });
	toast("🎲 " + theme.name);
}

/** Apply a built-in look; its desktop wallpaper only where the host can actually serve one. */
function applyBuiltinLook(look, quiet) {
	const patch = mergePatch({}, look.patch);
	if (patch.wallpaper?.src === DESKTOP_WALLPAPER && !snapshot.env.desktopWallpaper) delete patch.wallpaper;
	update(patch);
	if (!quiet) toast(t("toast.look", { name: tOr("look." + look.id, look.name) }));
}

/** Save the current theme + style + wallpaper as a named look. */
function saveLook(name, emoji) {
	const s = snapshot.state;
	const look = { id: "l_" + Date.now().toString(36), name: name.trim() || t("looks.untitled"), emoji: emoji || "✨", theme: s.theme, style: s.style, wallpaper: s.wallpaper };
	update({ looks: [...s.looks, look] });
	toast(t("toast.lookSaved", { name: look.name }));
}

function applyUserLook(look, quiet) {
	update({ theme: look.theme, style: look.style, wallpaper: look.wallpaper });
	if (!quiet) toast(t("toast.look", { name: look.name }));
}

/** Schedule / palette targets: "theme:<id>", "look:<id>", "builtin:<id>". */
function scheduleTargets(state) {
	return [
		...state.looks.map((l) => ({ id: "look:" + l.id, label: `${l.emoji} ${l.name}`, group: t("schedule.groupLooks") })),
		...LOOKS.map((l) => ({ id: "builtin:" + l.id, label: `🫧 ${tOr("look." + l.id, l.name)}`, group: t("schedule.groupLooks") })),
		...themeChoices(state).map((c) => ({ id: "theme:" + c.id, label: `${c.emoji} ${c.name}`, group: t("schedule.groupThemes") })),
	];
}

function applyTarget(target, quiet) {
	const [kind, ...rest] = target.split(":");
	const id = rest.join(":");
	if (kind === "theme") applyTheme(id, quiet);
	else if (kind === "look") {
		const look = snapshot.state.looks.find((l) => l.id === id);
		if (look) applyUserLook(look, quiet);
	} else if (kind === "builtin") {
		const look = LOOKS.find((l) => l.id === id);
		if (look) applyBuiltinLook(look, quiet);
	}
}

/** Apply the schedule slot in force, once per slot, so manual changes stick until the next switch. */
function scheduleTick() {
	const sched = snapshot.state.schedule;
	if (!snapshot.loaded || !sched.enabled || !sched.entries.length) return;
	const slot = scheduleSlot(sched.entries, new Date());
	if (!slot || slot.key === sched.applied) return;
	applyTarget(slot.entry.target, true);
	update({ schedule: { applied: slot.key } });
	const label = scheduleTargets(snapshot.state).find((x) => x.id === slot.entry.target)?.label ?? slot.entry.target;
	toast(t("toast.scheduled", { name: label }));
}
//#endregion

//#region appearance, layout, navigation
function setAppearance(pref) {
	try {
		services.theme?.setTheme(pref);
		toast(t("toast.appearance." + pref));
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
	toast(t("toast.textSize", { px: next }));
}

function openStudio(tab) {
	if (tab) setSnap({ tab });
	try {
		services.layout?.selectPanel(PANEL_ID);
	} catch (e) {
		toast(errorText(e));
	}
}

let focusCollapsedSidebar = false;
/** Focus mode: fold the sidebar away and close the right panel; again to restore. */
function toggleFocus() {
	const layout = services.layout;
	const entering = !snapshot.focus;
	const sidebar = document.querySelector('[class*="_sidebarCol"]');
	const expanded = Boolean(sidebar && sidebar.getBoundingClientRect().width > 120);
	try {
		if (entering) {
			focusCollapsedSidebar = expanded;
			if (expanded) layout?.toggleSidebar();
			layout?.closeRightbar();
		} else if (focusCollapsedSidebar && !expanded) {
			layout?.toggleSidebar();
		}
	} catch { /* layout service unavailable */ }
	setSnap({ focus: entering });
	toast(t(entering ? "toast.focusOn" : "toast.focusOff"));
}
//#endregion

//#region updates
async function loadUpdates() {
	try {
		const updates = await apiGet("updates");
		setSnap({ updates });
		const done = updates.justUpdated;
		if (done) {
			const key = `dsh-studio:announced:${done.to}`;
			let announced = false;
			try { announced = localStorage.getItem(key) === "1"; localStorage.setItem(key, "1"); } catch { /* storage blocked */ }
			if (!announced) toast(t(compareVersions(done.to, done.from) < 0 ? "toast.downgraded" : "toast.updated", { version: done.to }));
		}
	} catch { /* older host or offline: the Updates tab says so */ }
}

async function checkForUpdates() {
	try {
		setSnap({ updates: await apiPost("updates", { action: "check" }) });
	} catch (e) {
		toast(errorText(e));
		void loadUpdates();
	}
}

/** Auto-update on/off; turning it on makes the host check (and maybe install) right away. */
function setAutoUpdates(on) {
	update({ updates: { auto: on } });
	toast(t(on ? "toast.autoOn" : "toast.autoOff"));
	for (const ms of [1500, 6000]) setTimeout(loadUpdates, ms);
}

async function installVersion(version) {
	try {
		setSnap({ updates: await apiPost("updates", { action: "install", version }) });
		toast(t("toast.installing", { version }));
	} catch (e) {
		toast(errorText(e));
		void loadUpdates();
	}
}
//#endregion

//#region images
async function loadImage(src) {
	return await new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(t("error.image")));
		img.src = src;
	});
}

/** Pixels of an image (file, data URL or same-origin URL), downscaled so analysis stays instant. */
async function imagePixels(source, maxDim = 220) {
	const url = source instanceof Blob ? URL.createObjectURL(source) : source;
	try {
		const img = await loadImage(url);
		const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
		const w = Math.max(1, Math.round(img.naturalWidth * scale));
		const ht = Math.max(1, Math.round(img.naturalHeight * scale));
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = ht;
		const g = canvas.getContext("2d", { willReadFrequently: true });
		g.drawImage(img, 0, 0, w, ht);
		return g.getImageData(0, 0, w, ht).data;
	} finally {
		if (source instanceof Blob) URL.revokeObjectURL(url);
	}
}

async function imageFileToDataUrl(file, maxDim, type, quality) {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImage(url);
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

function copyText(text) {
	try {
		void navigator.clipboard?.writeText(text);
		return true;
	} catch {
		return false;
	}
}
//#endregion

//#region saved prompts
/** Open composers by Session id, registered by the composer button. */
const composers = new Map();
let lastComposer = null;

function insertText(text, sessionId) {
	const entry = composers.get(sessionId ?? lastComposer) ?? [...composers.values()].pop();
	if (!entry) {
		toast(copyText(text) ? t("toast.noChatCopied") : t("toast.noChat"));
		return;
	}
	const { actions, getDraft } = entry;
	try {
		if (actions.insertText(text, actions.captureInsertion())) return;
	} catch { /* fall back to setDraft */ }
	const draft = getDraft();
	actions.setDraft(draft ? draft.replace(/\s+$/, "") + "\n\n" + text : text);
}

async function readClipboard() {
	try {
		return (await navigator.clipboard.readText()) ?? "";
	} catch {
		toast(t("toast.clipboardBlocked"));
		return "";
	}
}

/** Insert a saved prompt, first asking for any {ask:…} answers and reading {clipboard}. */
async function insertPrompt(prompt, sessionId) {
	const needs = promptPlaceholders(prompt.text);
	if (needs.asks.length) {
		setSnap({ promptFill: { prompt, sessionId, asks: needs.asks } });
		return;
	}
	const clipboard = needs.clipboard ? await readClipboard() : "";
	insertText(fillPrompt(prompt.text, { clipboard, locale: snapshot.lang }), sessionId);
}

async function finishPromptFill(answers) {
	const fill = snapshot.promptFill;
	setSnap({ promptFill: null });
	if (!fill) return;
	const clipboard = promptPlaceholders(fill.prompt.text).clipboard ? await readClipboard() : "";
	insertText(fillPrompt(fill.prompt.text, { clipboard, answers, locale: snapshot.lang }), fill.sessionId);
}

const PACK_PREFIX = "dshp1:";
function encodePromptPack(prompts) {
	return PACK_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(prompts.map(({ title, text, folder }) => ({ title, text, folder }))))));
}
function decodePromptPack(code) {
	const raw = String(code ?? "").trim();
	if (!raw.startsWith(PACK_PREFIX)) throw new Error(t("prompts.packInvalid"));
	const list = JSON.parse(decodeURIComponent(escape(atob(raw.slice(PACK_PREFIX.length)))));
	if (!Array.isArray(list)) throw new Error(t("prompts.packInvalid"));
	return list;
}

/** Add prompts (from a pack or file), skipping exact duplicates. */
function addPrompts(list) {
	const current = snapshot.state.prompts;
	const seen = new Set(current.map((p) => p.title + "\n" + p.text));
	const fresh = list
		.filter((p) => typeof p?.text === "string" && !seen.has((p.title ?? "") + "\n" + p.text))
		.map((p, i) => ({ id: "p_" + Date.now().toString(36) + i, title: String(p.title ?? t("prompts.untitled")), text: p.text, folder: String(p.folder ?? "") }));
	update({ prompts: [...current, ...fresh] });
	return fresh.length;
}
//#endregion
