//#region Theme editor tab
function ColorRow({ label, value, onChange, badge }) {
	const [text, setText] = useState(value);
	useEffect(() => setText(value), [value]);
	const commitText = (raw) => {
		const hex = normHex(raw);
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
	const theme = choice.theme;
	return { id: choice.custom ? theme.id : null, name: choice.custom ? theme.name : t("editor.myName", { name: choice.name }), dark: { ...theme.dark }, light: { ...theme.light } };
}

const SHARE_PREFIX = "dshs1:";
function encodeTheme(theme) {
	return SHARE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ n: theme.name, d: theme.dark, l: theme.light }))));
}
function decodeTheme(code) {
	const raw = String(code ?? "").trim();
	if (!raw.startsWith(SHARE_PREFIX)) throw new Error(t("editor.codeInvalid"));
	const obj = JSON.parse(decodeURIComponent(escape(atob(raw.slice(SHARE_PREFIX.length)))));
	const cleaned = sanitizeState({ customThemes: [{ id: "x", name: obj.n, dark: obj.d, light: obj.l }] }).customThemes[0];
	if (!cleaned) throw new Error(t("editor.codeDamaged"));
	return cleaned;
}

/** Open GitHub's "new file" page with this theme as a gallery entry, ready to propose. */
function submitToGallery(draft) {
	const slug = (draft.name || "theme").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "theme";
	const entry = { id: slug, name: draft.name, emoji: "🎨", author: snapshot.state.identity.name || "", description: "", dark: draft.dark, light: draft.light };
	const repo = REPO_URL.replace("https://github.com/", "");
	const url = `https://github.com/${repo}/new/main/gallery/themes?filename=${encodeURIComponent(slug + ".json")}&value=${encodeURIComponent(JSON.stringify(entry, null, 2) + "\n")}`;
	window.open(url, "_blank", "noopener");
}

function EditorTab() {
	const state = useSnap((s) => s.state);
	const env = useSnap((s) => s.env);
	const [draft, setDraft] = useState(() => draftFrom(state));
	const [livePreview, setLivePreview] = useState(true);
	const [shareBox, setShareBox] = useState(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setSnap({ preview: livePreview ? { theme: draft } : undefined });
	}, [draft, livePreview]);
	useEffect(() => () => setSnap({ preview: undefined }), []);

	const setColor = (mode, key, hex) => setDraft((d) => ({ ...d, [mode]: { ...d[mode], [key]: hex } }));

	const fromImage = async (source, name) => {
		setBusy(true);
		try {
			const pixels = await imagePixels(source);
			const theme = themeFromPalette(extractPalette(pixels), name);
			setDraft({ id: null, name: theme.name, dark: theme.dark, light: theme.light });
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

	const save = (asNew) => {
		const id = !asNew && draft.id ? draft.id : newId("c");
		const entry = { id, name: draft.name.trim() || t("editor.untitled"), dark: draft.dark, light: draft.light };
		const exists = state.customThemes.some((c) => c.id === id);
		const next = exists ? state.customThemes.map((c) => (c.id === id ? entry : c)) : [...state.customThemes, entry];
		setDraft({ ...draft, id, name: entry.name });
		update({ customThemes: next, theme: { active: "custom:" + id } });
		toast(t("editor.saved", { name: entry.name }));
	};

	const remove = () => {
		if (!draft.id) return;
		const next = state.customThemes.filter((c) => c.id !== draft.id);
		update({ customThemes: next, ...(state.theme.active === "custom:" + draft.id ? { theme: { active: "default" } } : {}) });
		setDraft(draftFrom({ ...state, customThemes: next, theme: { ...state.theme, active: "default" } }, "default"));
		toast(t("editor.deleted"));
	};

	const importCode = () => {
		try {
			const theme = decodeTheme(shareBox ?? "");
			setDraft({ id: null, name: theme.name, dark: theme.dark, light: theme.light });
			setShareBox(null);
			toast(t("editor.imported", { name: theme.name }));
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
				h(ColorRow, { label: t("editor.background"), value: m.bg, onChange: (v) => setColor(mode, "bg", v) }),
				h(ColorRow, { label: t("editor.text"), value: m.fg, onChange: (v) => setColor(mode, "fg", v), badge: h(ContrastBadge, { fg: m.fg, bg: m.bg, min: 7, label: t("editor.text") }) }),
				h(ColorRow, { label: t("editor.accent"), value: m.accent, onChange: (v) => setColor(mode, "accent", v), badge: h(ContrastBadge, { fg: m.accent, bg: m.bg, min: 3, label: t("editor.accent") }) }),
			),
		);
	};

	return [
		h(Section, { key: "pick", title: t("editor.title"), description: t("editor.description") },
			h("div", { className: "st_row" },
				h(Field, { label: t("editor.startFrom") },
					h(Select, {
						value: "",
						options: [{ id: "", label: t("editor.chooseTheme") }, ...themeChoices(state).map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }))],
						onChange: (id) => { if (id) setDraft(draftFrom(state, id)); },
					})),
				h(Field, { label: t("editor.name") },
					h("input", { className: "st_input", value: draft.name, maxLength: 80, onChange: (e) => setDraft({ ...draft, name: e.target.value }) })),
			),
			h(Toggle, { checked: livePreview, onChange: setLivePreview, label: t("editor.livePreview"), hint: t("editor.livePreviewHint") }),
		),
		h(Section, { key: "image", title: t("editor.fromImageTitle"), description: t("editor.fromImageDescription") },
			h("div", { className: "st_actions" },
				env.desktopWallpaper ? h(Button, { disabled: busy, onClick: () => void fromImage(DESKTOP_WALLPAPER_URL, t("editor.fromDesktopName")) }, t("editor.fromDesktop")) : null,
				state.wallpaper.src ? h(Button, { disabled: busy, onClick: () => void fromImage(state.wallpaper.src === DESKTOP_WALLPAPER ? DESKTOP_WALLPAPER_URL : state.wallpaper.src, t("editor.fromWallpaperName")) }, t("editor.fromWallpaper")) : null,
				h(Button, { disabled: busy, onClick: () => void uploadForTheme() }, t("editor.fromUpload")),
				busy ? h("span", { className: "st_hint" }, t("editor.analysing")) : null)),
		h("div", { key: "cols", className: "st_editorGrid" }, modeColumn("dark", "🌙 " + t("appearance.dark")), modeColumn("light", "☀️ " + t("appearance.light"))),
		h(Section, { key: "save", title: draft.id ? t("editor.editing", { name: draft.name }) : t("editor.newTheme") },
			h("div", { className: "st_actions" },
				h(Button, { kind: "primary", onClick: () => save(false) }, draft.id ? t("editor.saveChanges") : t("editor.saveApply")),
				draft.id ? h(Button, { onClick: () => save(true) }, t("editor.saveCopy")) : null,
				h(Button, { onClick: () => { const r = randomTheme(); setDraft({ id: draft.id, name: draft.name, dark: r.dark, light: r.light }); } }, t("editor.randomise")),
				h(Button, { onClick: () => { const code = encodeTheme(draft); copyText(code); setShareBox(code); toast(t("editor.codeCopied")); } }, t("editor.shareCode")),
				h(Button, { onClick: () => setShareBox(shareBox == null ? "" : null) }, t("editor.importCode")),
				h(Button, { onClick: () => submitToGallery(draft) }, t("editor.submitGallery")),
				draft.id ? h(Button, { kind: "danger", onClick: remove }, t("common.delete")) : null,
			),
			shareBox != null
				? h("div", { className: "st_row" },
					h(Field, { label: t("editor.codeLabel"), hint: t("editor.codeHint") },
						h("input", { className: "st_input st_mono", value: shareBox, onChange: (e) => setShareBox(e.target.value) })),
					h(Button, { onClick: importCode }, t("editor.loadCode")))
				: null,
		),
	];
}
//#endregion
