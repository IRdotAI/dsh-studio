//#region Theme editor tab
/** Any CSS colour — hex, rgb(), hsl(), or a name like "tomato" — as "#rrggbb", or null. */
let colorProbe = null;
function cssColorToHex(raw) {
	const text = String(raw ?? "").trim();
	const hex = normHex(text);
	if (hex || !text) return hex;
	try {
		colorProbe ??= document.createElement("canvas").getContext("2d");
		colorProbe.fillStyle = "#010203";
		colorProbe.fillStyle = text;
		const value = String(colorProbe.fillStyle);
		if (value === "#010203") return null;
		if (value.startsWith("#")) return normHex(value);
		const rgb = value.match(/rgba?\(([^)]+)\)/)?.[1].split(",").slice(0, 3).map((x) => Math.round(Number(x)));
		return rgb?.every((x) => x >= 0 && x <= 255) ? normHex("#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("")) : null;
	} catch {
		return null;
	}
}

/** Chrome and Edge can sample any pixel on screen. */
const hasEyeDropper = () => typeof window !== "undefined" && typeof window.EyeDropper === "function";
async function pickFromScreen() {
	try {
		return cssColorToHex((await new window.EyeDropper().open()).sRGBHex);
	} catch {
		return null; // cancelled with Esc
	}
}

function ColorRow({ label, value, onChange, badge, auto, locked, onLock, onAuto }) {
	const [text, setText] = useState(value);
	useEffect(() => setText(value), [value]);
	const commitText = (raw) => {
		const hex = cssColorToHex(raw);
		if (hex) onChange(hex);
		else setText(value);
	};
	return h("div", { className: "st_color" },
		// Dragging in the picker fires continuously; `true` folds the drag into one undo step.
		h("input", { type: "color", value, onChange: (e) => onChange(e.target.value, true), "aria-label": label }),
		h("span", { className: "st_label" }, label, auto ? h("span", { className: "st_hint" }, " · " + t("editor.auto")) : null),
		badge ?? null,
		h("input", {
			// Colour codes read left to right even in right-to-left languages ("#abc", not "abc#").
			className: "st_input", dir: "ltr", value: text, spellCheck: false, title: t("editor.anyColour"), "aria-label": label,
			onChange: (e) => setText(e.target.value),
			onBlur: (e) => commitText(e.target.value),
			onKeyDown: (e) => { if (e.key === "Enter") commitText(e.currentTarget.value); },
		}),
		hasEyeDropper()
			? h("button", { type: "button", className: "st_iconBtn", title: t("editor.eyedropper"), "aria-label": t("editor.eyedropper"), onClick: async () => { const hex = await pickFromScreen(); if (hex) onChange(hex); } }, "💧")
			: null,
		onAuto ? h("button", { type: "button", className: "st_iconBtn", title: t("editor.accent2Auto"), "aria-label": t("editor.accent2Auto"), onClick: onAuto }, "↺") : null,
		onLock
			? h("button", { type: "button", className: cls("st_iconBtn", locked && "st_iconBtn_on"), "aria-pressed": Boolean(locked), title: t(locked ? "editor.unlock" : "editor.lock"), "aria-label": t(locked ? "editor.unlock" : "editor.lock"), onClick: onLock }, locked ? "🔒" : "🔓")
			: null,
	);
}

function draftFrom(state, choiceId) {
	const choice = themeChoices(state).find((c) => c.id === (choiceId ?? state.theme.active)) ?? themeChoices(state)[0];
	const theme = choice.theme;
	return { id: choice.custom ? theme.id : null, name: choice.custom ? theme.name : t("editor.myName", { name: choice.name }), dark: { ...theme.dark }, light: { ...theme.light } };
}

const SHARE_PREFIX = "dshs1:";
function encodeTheme(theme) {
	return SHARE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ n: theme.name, d: theme.dark, l: theme.light }))));
}
/** A theme from loose input (a share code, a gallery entry or a theme file), cleaned like saved settings. */
function cleanThemeInput(name, dark, light) {
	const cleaned = sanitizeState({ customThemes: [{ id: "x", name, dark, light }] }).customThemes[0];
	if (!cleaned) throw new Error(t("editor.codeDamaged"));
	return cleaned;
}
function decodeTheme(code) {
	const raw = String(code ?? "").trim();
	if (!raw.startsWith(SHARE_PREFIX)) throw new Error(t("editor.codeInvalid"));
	const obj = JSON.parse(decodeURIComponent(escape(atob(raw.slice(SHARE_PREFIX.length)))));
	return cleanThemeInput(obj.n, obj.d, obj.l);
}

const themeSlug = (name) => (name || "theme").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "theme";

/** The theme as a gallery entry: the format of gallery/themes/*.json and of downloaded theme files. */
function galleryEntry(draft) {
	return { id: themeSlug(draft.name), name: draft.name, emoji: "🎨", author: snapshot.state.identity.name || "", description: "", dark: draft.dark, light: draft.light };
}

/** Open GitHub's "new file" page with this theme as a gallery entry, ready to propose. */
function submitToGallery(draft) {
	const entry = galleryEntry(draft);
	const repo = REPO_URL.replace("https://github.com/", "");
	const url = `https://github.com/${repo}/new/main/gallery/themes?filename=${encodeURIComponent(entry.id + ".json")}&value=${encodeURIComponent(JSON.stringify(entry, null, 2) + "\n")}`;
	window.open(url, "_blank", "noopener");
}

/** Draft with undo/redo. `merge` folds rapid changes (dragging a picker or a slider) into one step. */
function useHistory(initial) {
	const [hist, setHist] = useState(() => ({ past: [], present: initial, future: [], at: 0 }));
	const set = (next, merge = false) => setHist((s) => {
		const value = typeof next === "function" ? next(s.present) : next;
		if (value === s.present) return s;
		const now = Date.now();
		const fold = merge && now - s.at < 700;
		return { past: fold ? s.past : [...s.past, s.present].slice(-60), present: value, future: [], at: merge ? now : 0 };
	});
	const undo = () => setHist((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future], at: 0 } : s));
	const redo = () => setHist((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1), at: 0 } : s));
	return { draft: hist.present, set, undo, redo, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 };
}

/** Colour-vision simulations for the previews (Machado et al. 2009, full severity, in linear RGB). */
const CVD_FILTERS = {
	protan: "0.152 1.053 -0.205 0 0 0.115 0.786 0.099 0 0 -0.004 -0.048 1.052 0 0 0 0 0 1 0",
	deutan: "0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0",
	tritan: "1.256 -0.077 -0.179 0 0 -0.078 0.931 0.148 0 0 0.005 0.691 0.304 0 0 0 0 0 1 0",
};
const CVD_MODES = ["none", "protan", "deutan", "tritan", "grey"];
const cvdFilter = (mode) => (mode === "grey" ? "grayscale(1)" : CVD_FILTERS[mode] ? `url(#st-cvd-${mode})` : undefined);

const NO_TUNE = { hue: 0, vivid: 100, warmth: 0, depth: 0 };
const COLOR_KEYS = ["bg", "fg", "accent", "accent2"];

function EditorTab() {
	const state = useSnap((s) => s.state);
	const env = useSnap((s) => s.env);
	const hist = useHistory(draftFrom(state));
	const draft = hist.draft;
	const [livePreview, setLivePreview] = useState(true);
	const [shareBox, setShareBox] = useState(null);
	const [busy, setBusy] = useState(false);
	const [locks, setLocks] = useState(() => new Set());
	const [seed, setSeed] = useState(() => normHex(env.windowsAccent) ?? draft.dark.accent);
	const [harmony, setHarmony] = useState("complementary");
	const [word, setWord] = useState("");
	const [cvd, setCvd] = useState("none");
	// Fine-tune sliders work from the theme as it was when you started sliding, so they never drift.
	const [tune, setTune] = useState(NO_TUNE);
	const tuneBase = useRef(null);

	useEffect(() => {
		setSnap({ preview: livePreview ? { theme: draft } : undefined });
	}, [draft, livePreview]);
	useEffect(() => () => setSnap({ preview: undefined }), []);

	const resetTune = () => {
		tuneBase.current = null;
		setTune(NO_TUNE);
	};
	/** Any edit other than the sliders: the sliders start again from the result. */
	const change = (next, merge = false) => {
		resetTune();
		hist.set(next, merge);
	};
	const undo = () => { resetTune(); hist.undo(); };
	const redo = () => { resetTune(); hist.redo(); };
	const keys = useRef({ undo, redo });
	keys.current = { undo, redo };
	useEffect(() => {
		const onKey = (e) => {
			if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
			const el = document.activeElement;
			const typing = el && (el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && !["color", "range", "checkbox", "button"].includes(el.type)));
			if (typing) return; // text fields keep their own undo
			const k = e.key.toLowerCase();
			if (k === "z" && !e.shiftKey) { e.preventDefault(); keys.current.undo(); }
			else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); keys.current.redo(); }
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const setColor = (mode, key, hex, merge) => change((d) => ({ ...d, [mode]: { ...d[mode], [key]: hex } }), merge);
	const clearAccent2 = (mode) => change((d) => {
		const { accent2, ...rest } = d[mode];
		return { ...d, [mode]: rest };
	});
	const toggleLock = (key) => setLocks((s) => {
		const next = new Set(s);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});
	const modesOf = (theme) => ({ dark: { ...theme.dark }, light: { ...theme.light } });

	/** A generated theme starts a new one; locked colours carry over from the current draft. */
	const generate = (theme, name) => {
		const next = { id: null, name: name ?? theme.name ?? draft.name, ...modesOf(theme) };
		for (const key of locks) {
			const [mode, k] = key.split(".");
			if (draft[mode][k]) next[mode][k] = draft[mode][k];
			else delete next[mode][k];
		}
		change(next);
	};
	/** Edits of the current theme (variations, mirroring, fixes) keep its name and id. */
	const edit = (theme, merge = false) => change((d) => ({ ...d, ...modesOf(theme) }), merge);

	const retune = (patch) => {
		const next = { ...tune, ...patch };
		const base = tuneBase.current ?? draft;
		tuneBase.current = base;
		setTune(next);
		const adjusted = adjustTheme(base, { hue: next.hue, vivid: next.vivid / 100, warmth: next.warmth / 100, depth: next.depth / 100 });
		hist.set((d) => ({ ...d, ...modesOf(adjusted) }), true);
	};

	const fromImage = async (source, name) => {
		setBusy(true);
		try {
			const pixels = await imagePixels(source);
			generate(themeFromPalette(extractPalette(pixels), name));
			toast(t("editor.fromImageDone"));
		} catch (e) {
			toast(t("editor.fromImageFailed", { error: errorText(e) }));
		} finally {
			setBusy(false);
		}
	};
	const uploadForTheme = async () => {
		const file = await pickFile("image/*");
		if (file) await fromImage(file, file.name.replace(/\.[^.]+$/, "").slice(0, 40) || t("editor.fromImageName"));
	};
	const fromWord = () => {
		if (word.trim()) generate(themeFromWord(word));
	};

	const save = (asNew) => {
		const id = !asNew && draft.id ? draft.id : newId("c");
		const entry = { id, name: draft.name.trim() || t("editor.untitled"), ...modesOf(draft) };
		const exists = state.customThemes.some((c) => c.id === id);
		const next = exists ? state.customThemes.map((c) => (c.id === id ? entry : c)) : [...state.customThemes, entry];
		hist.set({ ...draft, id, name: entry.name });
		update({ customThemes: next, theme: { active: "custom:" + id } });
		toast(t("editor.saved", { name: entry.name }));
	};

	const remove = () => {
		if (!draft.id) return;
		const next = state.customThemes.filter((c) => c.id !== draft.id);
		update({ customThemes: next, ...(state.theme.active === "custom:" + draft.id ? { theme: { active: "default" } } : {}) });
		change(draftFrom({ ...state, customThemes: next, theme: { ...state.theme, active: "default" } }, "default"));
		toast(t("editor.deleted"));
	};

	const loadTheme = (theme) => {
		change({ id: null, name: theme.name, ...modesOf(theme) });
		toast(t("editor.imported", { name: theme.name }));
	};
	const importCode = () => {
		try {
			loadTheme(decodeTheme(shareBox ?? ""));
			setShareBox(null);
		} catch (e) {
			toast(errorText(e));
		}
	};
	const downloadFile = () => {
		const entry = galleryEntry(draft);
		downloadText(entry.id + ".json", JSON.stringify(entry, null, 2) + "\n", "application/json");
		toast(t("editor.fileSaved"));
	};
	const openFile = async () => {
		const file = await pickFile(".json,application/json,text/plain");
		if (!file) return;
		try {
			const text = (await file.text()).trim();
			if (text.startsWith(SHARE_PREFIX)) loadTheme(decodeTheme(text));
			else {
				const obj = JSON.parse(text);
				loadTheme(cleanThemeInput(obj.name || file.name.replace(/\.[^.]+$/, ""), obj.dark, obj.light));
			}
		} catch {
			toast(t("editor.fileInvalid"));
		}
	};

	const shown = (m, key) => (key === "accent2" ? m.accent2 ?? autoAccent2(m) : m[key]);
	const allReadable = ["dark", "light"].every((mode) => ["fg", "accent", "accent2"].every((key) => contrast(shown(draft[mode], key), draft[mode].bg) >= EDITOR_MINIMUMS[key]));
	/** Fix every colour that falls short, including an automatic second accent (which then becomes a set one). */
	const fixAll = () => {
		const next = { ...draft };
		for (const mode of ["dark", "light"]) {
			const m = { ...draft[mode] };
			if (!m.accent2 && contrast(autoAccent2(m), m.bg) < EDITOR_MINIMUMS.accent2) m.accent2 = autoAccent2(m);
			next[mode] = m;
		}
		edit(fixContrast(next));
	};
	const variations = useMemo(() => themeVariations(draft), [draft]);

	const modeColumn = (mode, title) => {
		const m = draft[mode];
		const labels = { bg: t("editor.background"), fg: t("editor.text"), accent: t("editor.accent"), accent2: t("editor.accent2") };
		const row = (key) => h(ColorRow, {
			key,
			label: labels[key],
			value: shown(m, key),
			auto: key === "accent2" && !m.accent2,
			onChange: (hex, merge) => setColor(mode, key, hex, merge),
			badge: key === "bg" ? null : h(ContrastBadge, {
				fg: shown(m, key), bg: m.bg, min: EDITOR_MINIMUMS[key], label: labels[key],
				onFix: () => edit(fixContrast({ ...draft, [mode]: { ...m, [key]: shown(m, key) } }, [mode])),
			}),
			locked: locks.has(mode + "." + key),
			onLock: () => toggleLock(mode + "." + key),
			onAuto: key === "accent2" && m.accent2 ? () => clearAccent2(mode) : null,
		});
		return h("div", { className: "st_modeCol", style: { background: m.bg, color: m.fg, filter: cvdFilter(cvd) } },
			h("div", { className: "st_modeTitle" }, title),
			h("div", { className: "st_bigMock" }, h(Mock, { m })),
			h("div", { className: "st_colorBox" }, COLOR_KEYS.map(row)),
			h("div", null,
				h(Button, { small: true, onClick: () => edit(mirrorMode(draft, mode)), title: t("editor.mirrorHint") },
					mode === "dark" ? t("editor.mirrorToLight") : t("editor.mirrorToDark"))),
		);
	};

	const pct = (v) => `${v}%`;
	const signed = (v, minus, plus) => (v === 0 ? t("tune.neutral") : `${v < 0 ? minus : plus} ${Math.abs(v)}`);

	return [
		h("svg", { key: "cvd", width: 0, height: 0, style: { position: "absolute" }, "aria-hidden": true, focusable: "false" },
			h("defs", null, Object.entries(CVD_FILTERS).map(([id, values]) =>
				h("filter", { key: id, id: "st-cvd-" + id, colorInterpolationFilters: "linearRGB" }, h("feColorMatrix", { type: "matrix", values }))))),
		h(Section, { key: "pick", title: t("editor.title"), description: t("editor.description") },
			h("div", { className: "st_row" },
				h(Field, { label: t("editor.startFrom") },
					h(Select, {
						value: "",
						options: [{ id: "", label: t("editor.chooseTheme") }, ...themeChoices(state).map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))],
						onChange: (id) => { if (id) change(draftFrom(state, id)); },
					})),
				h(Field, { label: t("editor.name") },
					h("input", { className: "st_input", value: draft.name, maxLength: 80, onChange: (e) => change({ ...draft, name: e.target.value }, true) })),
			),
			h(Toggle, { checked: livePreview, onChange: setLivePreview, label: t("editor.livePreview"), hint: t("editor.livePreviewHint") }),
		),
		h(Section, { key: "make", title: t("editor.makeTitle"), description: t("editor.makeDescription") },
			h(Field, { label: t("editor.moods"), group: true },
				h("div", { className: "st_moods" }, MOODS.map((mood) =>
					h("button", { key: mood.id, type: "button", className: "st_mood", title: t("editor.moodHint"), onClick: () => generate(themeFromMood(mood.id, t("mood." + mood.id))) },
						h("span", { "aria-hidden": true }, mood.emoji), t("mood." + mood.id))))),
			h("div", { className: "st_makeRow" },
				h("div", { className: "st_makeColor" }, h(ColorRow, { label: t("editor.oneColour"), value: seed, onChange: (hex) => setSeed(hex) })),
				h(Field, { label: t("editor.harmony"), narrow: true },
					h(Select, { value: harmony, options: HARMONIES.map((x) => ({ id: x.id, label: t("harmony." + x.id) })), onChange: setHarmony })),
				h(Button, { onClick: () => generate(themeFromColor(seed, harmony, t("editor.colourThemeName", { harmony: t("harmony." + harmony) }))) }, t("editor.buildFromColour"))),
			h("div", { className: "st_makeRow" },
				h(Field, { label: t("editor.word"), hint: t("editor.wordHint") },
					h("input", { className: "st_input", value: word, maxLength: 40, placeholder: t("editor.wordPlaceholder"), onChange: (e) => setWord(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") fromWord(); } })),
				h(Button, { disabled: !word.trim(), onClick: fromWord }, t("editor.buildFromWord")),
				h(Button, { onClick: () => generate(randomTheme()) }, t("editor.randomise"))),
			h("p", { className: "st_hint", style: { margin: 0 } }, locks.size ? t("editor.locksOn", { count: locks.size }) : t("editor.locksHint")),
		),
		h(Section, { key: "image", title: t("editor.fromImageTitle"), description: t("editor.fromImageDescription") },
			h("div", { className: "st_actions" },
				env.desktopWallpaper ? h(Button, { disabled: busy, onClick: () => void fromImage(DESKTOP_WALLPAPER_URL, t("editor.fromDesktopName")) }, t("editor.fromDesktop")) : null,
				// Whatever the wallpaper is right now: an image, the desktop, today's Bing picture or the current slide.
				state.wallpaper.src && state.wallpaper.src !== "video"
					? h(Button, { disabled: busy, onClick: () => void fromImage(wallpaperUrl(state.wallpaper, new Date(), slideIndex(env.wallpaperCount ?? 0, state.wallpaper.interval)), t("editor.fromWallpaperName")) }, t("editor.fromWallpaper"))
					: null,
				h(Button, { disabled: busy, onClick: () => void uploadForTheme() }, t("editor.fromUpload")),
				busy ? h("span", { className: "st_hint" }, t("editor.analysing")) : null)),
		h("div", { key: "tools", className: "st_editorTools" },
			h(Button, { small: true, disabled: !hist.canUndo, onClick: undo, title: "Ctrl+Z" }, "↶ " + t("editor.undo")),
			h(Button, { small: true, disabled: !hist.canRedo, onClick: redo, title: "Ctrl+Y" }, "↷ " + t("editor.redo")),
			h(Button, { small: true, disabled: allReadable, onClick: fixAll }, "✓ " + t("editor.fixAll")),
			h("span", { style: { flex: 1 } }),
			h("label", { className: "st_inline" },
				h("span", { className: "st_label" }, t("editor.seeAs")),
				h(Select, { value: cvd, options: CVD_MODES.map((id) => ({ id, label: t("cvd." + id) })), onChange: setCvd }))),
		h("div", { key: "cols", className: "st_editorGrid" }, modeColumn("dark", "🌙 " + t("appearance.dark")), modeColumn("light", "☀️ " + t("appearance.light"))),
		h(Section, {
			key: "tune", title: t("editor.tuneTitle"), description: t("editor.tuneDescription"),
			actions: tuneBase.current ? h(Button, { small: true, onClick: () => { if (tuneBase.current) edit(tuneBase.current); } }, t("editor.tuneReset")) : null,
		},
			h("div", { className: "st_sliders" },
				h(Slider, { label: t("tune.hue"), value: tune.hue, min: -180, max: 180, step: 5, onChange: (v) => retune({ hue: v }), format: (v) => `${v > 0 ? "+" : ""}${v}°` }),
				h(Slider, { label: t("tune.vivid"), value: tune.vivid, min: 0, max: 200, step: 5, onChange: (v) => retune({ vivid: v }), format: pct }),
				h(Slider, { label: t("tune.warmth"), value: tune.warmth, min: -100, max: 100, step: 5, onChange: (v) => retune({ warmth: v }), format: (v) => signed(v, t("tune.cooler"), t("tune.warmer")) }),
				h(Slider, { label: t("tune.depth"), value: tune.depth, min: -100, max: 100, step: 5, onChange: (v) => retune({ depth: v }), format: (v) => signed(v, t("tune.darker"), t("tune.lighter")) }))),
		h(Section, { key: "variations", title: t("editor.variationsTitle"), description: t("editor.variationsDescription") },
			h("div", { className: "st_varGrid" }, variations.map((v) =>
				h("button", { key: v.id, type: "button", className: "st_card", onClick: () => edit(v.theme) },
					h("div", { className: "st_cardMocks st_varMocks", style: { filter: cvdFilter(cvd) } }, h(Mock, { m: v.theme.dark }), h(Mock, { m: v.theme.light })),
					h("div", { className: "st_cardFoot" }, h("span", { className: "st_cardName" }, t("variation." + v.id))))))),
		h(Section, { key: "save", title: draft.id ? t("editor.editing", { name: draft.name }) : t("editor.newTheme") },
			h("div", { className: "st_actions" },
				h(Button, { kind: "primary", onClick: () => save(false) }, draft.id ? t("editor.saveChanges") : t("editor.saveApply")),
				draft.id ? h(Button, { onClick: () => save(true) }, t("editor.saveCopy")) : null,
				h(Button, { onClick: () => { const code = encodeTheme(draft); copyText(code); setShareBox(code); toast(t("editor.codeCopied")); } }, t("editor.shareCode")),
				h(Button, { onClick: () => setShareBox(shareBox == null ? "" : null) }, t("editor.importCode")),
				h(Button, { onClick: downloadFile }, t("editor.downloadFile")),
				h(Button, { onClick: () => void openFile() }, t("editor.openFile")),
				h(Button, { onClick: () => submitToGallery(draft) }, t("editor.submitGallery")),
				draft.id ? h(Button, { kind: "danger", onClick: remove }, t("common.delete")) : null,
			),
			shareBox != null
				? h("div", { className: "st_row" },
					h(Field, { label: t("editor.codeLabel"), hint: t("editor.codeHint") },
						h("input", { className: "st_input st_mono", dir: "ltr", value: shareBox, onChange: (e) => setShareBox(e.target.value) })),
					h(Button, { onClick: importCode }, t("editor.loadCode")))
				: null,
		),
	];
}
//#endregion
