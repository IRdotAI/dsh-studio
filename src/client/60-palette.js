//#region command palette (Ctrl+K)
function paletteItems(state) {
	const items = [];
	const G = (key) => t("palette.group." + key);
	for (const c of themeChoices(state)) {
		items.push({ id: "theme:" + c.id, group: G("themes"), icon: c.emoji, label: c.name, hint: state.theme.active === c.id ? t("palette.current") : "", preview: { theme: c.id === "default" ? null : c.theme }, run: () => applyTheme(c.id) });
	}
	items.push({ id: "surprise", group: G("themes"), icon: "🎲", label: t("palette.surprise"), hint: t("palette.surpriseHint"), run: surprise });
	for (const look of state.looks) items.push({ id: "look:" + look.id, group: G("looks"), icon: look.emoji, label: look.name, run: () => applyUserLook(look) });
	for (const look of LOOKS) items.push({ id: "builtin:" + look.id, group: G("looks"), icon: "🫧", label: tOr("look." + look.id, look.name), hint: t("palette.lookHint"), run: () => applyBuiltinLook(look) });
	items.push({
		id: "material", group: G("looks"), icon: state.style.material === "glass" ? "▢" : "🫧",
		label: state.style.material === "glass" ? t("palette.solid") : t("palette.glass"),
		run: () => update({ style: { material: state.style.material === "glass" ? "solid" : "glass" } }),
	});
	if (services.theme) {
		items.push({ id: "mode:light", group: G("appearance"), icon: "☀️", label: t("palette.light"), run: () => setAppearance("light") });
		items.push({ id: "mode:dark", group: G("appearance"), icon: "🌙", label: t("palette.dark"), run: () => setAppearance("dark") });
		items.push({ id: "mode:system", group: G("appearance"), icon: "💻", label: t("palette.system"), run: () => setAppearance("system") });
		items.push({ id: "font:+", group: G("appearance"), icon: "🔠", label: t("palette.larger"), run: () => bumpFontSize(1) });
		items.push({ id: "font:-", group: G("appearance"), icon: "🔡", label: t("palette.smaller"), run: () => bumpFontSize(-1) });
	}
	items.push({ id: "focus", group: G("layout"), icon: "🎯", label: snapshot.focus ? t("palette.focusOff") : t("palette.focusOn"), run: toggleFocus });
	for (const w of CHAT_WIDTHS) items.push({ id: "width:" + w.id, group: G("layout"), icon: "↔", label: t("palette.width", { width: t("width." + w.id) }), hint: state.layout.chatWidth === w.id ? t("palette.current") : "", run: () => update({ layout: { chatWidth: w.id } }) });
	if (services.layout) items.push({ id: "sidebar", group: G("layout"), icon: "◧", label: t("palette.sidebar"), run: () => services.layout.toggleSidebar() });
	for (const a of AMBIENCES) {
		items.push({ id: "fx:" + a.id, group: G("ambience"), icon: "✨", label: t("ambience." + a.id), hint: state.style.ambience === a.id ? t("palette.current") : "", run: () => update({ style: { ambience: a.id } }) });
	}
	for (const p of state.prompts) items.push({ id: "prompt:" + p.id, group: G("prompts"), icon: "✦", label: p.title, hint: p.folder, run: () => void insertPrompt(p) });
	items.push({ id: "persona", group: G("ai"), icon: "🧠", label: state.persona.enabled ? t("palette.personaOff") : t("palette.personaOn"), run: () => update({ persona: { enabled: !state.persona.enabled } }) });
	for (const m of state.persona.modes) {
		const on = state.persona.enabled && state.persona.mode === m.id;
		items.push({ id: "mode:" + m.id, group: G("ai"), icon: m.emoji, label: t("palette.mode", { name: modeName(m) }), hint: on ? t("palette.current") : "", run: () => applyMode(m) });
	}
	items.push({ id: "export", group: G("chat"), icon: "📤", label: t("palette.export"), run: () => { const id = currentSessionId(); if (id) setSnap({ exportFor: id }); else toast(t("host.export.noSession")); } });
	items.push({ id: "a11y:contrast", group: G("appearance"), icon: "🔳", label: state.theme.active === "high-contrast" ? t("a11y.highContrastOff") : t("a11y.highContrastOn"), run: () => applyTheme(state.theme.active === "high-contrast" ? "default" : "high-contrast") });
	items.push({ id: "a11y:transparency", group: G("appearance"), icon: "◻️", label: state.style.reduceTransparency ? t("palette.transparencyOn") : t("palette.transparencyOff"), run: () => update({ style: { reduceTransparency: !state.style.reduceTransparency } }) });
	items.push({ id: "alerts", group: G("ai"), icon: "🔔", label: state.alerts.enabled ? t("palette.alertsOff") : t("palette.alertsOn"), run: () => update({ alerts: { enabled: !state.alerts.enabled } }) });
	items.push({ id: "backup", group: G("sync"), icon: "☁️", label: t("palette.backup"), run: async () => { try { await apiPost("sync", { action: "push" }); toast(t("sync.backedUp")); } catch (e) { toast(errorText(e)); } } });
	const u = snapshot.updates;
	if (u?.updateAvailable && !u.blocker) items.push({ id: "update-now", group: G("updates"), icon: "✨", label: t("palette.updateTo", { version: u.latest }), run: () => void installVersion(u.latest) });
	items.push({ id: "update-check", group: G("updates"), icon: "⟳", label: t("palette.checkUpdates"), hint: u ? `v${u.current}` : "", run: () => { void checkForUpdates(); openStudio("updates"); } });
	for (const x of TABS) items.push({ id: "open:" + x.id, group: G("studio"), icon: "🎨", label: t("palette.open", { page: t("tab." + x.id) }), run: () => openStudio(x.id) });
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

/** Asks for a saved prompt's {ask:…} answers before inserting it. */
function PromptFillDialog() {
	useT();
	const fill = useSnap((s) => s.promptFill);
	const [answers, setAnswers] = useState({});
	useEffect(() => setAnswers({}), [fill]);
	if (!fill) return null;
	const submit = () => void finishPromptFill(answers);
	return h("div", { className: "st_backdrop", onMouseDown: (e) => { if (e.target === e.currentTarget) setSnap({ promptFill: null }); } },
		h("form", { className: "st_dialog", role: "dialog", "aria-label": fill.prompt.title, onSubmit: (e) => { e.preventDefault(); submit(); } },
			h("div", { className: "st_dialogTitle" }, fill.prompt.title),
			fill.asks.map((label, i) => h(Field, { key: label, label },
				h("input", { className: "st_input", autoFocus: i === 0, value: answers[label] ?? "", onChange: (e) => setAnswers({ ...answers, [label]: e.target.value }) }))),
			h("div", { className: "st_actions" },
				h("button", { type: "submit", className: "st_btn st_btn_primary" }, t("prompts.insert")),
				h(Button, { onClick: () => setSnap({ promptFill: null }) }, t("common.cancel")))));
}

function CommandPalette() {
	useT();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [index, setIndex] = useState(0);
	const state = useSnap((s) => s.state);
	const toastText = useSnap((s) => s.toast);
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

	const items = useMemo(() => (open ? paletteItems(state) : []), [open, state, snapshot.dictRev]);
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
			? h("div", { key: "palette", className: "st_backdrop", dir: langDir(snapshot.lang), onMouseDown: (e) => { if (e.target === e.currentTarget) setOpen(false); } },
				h("div", { className: "st_palette", role: "dialog", "aria-label": t("palette.label") },
					h("input", {
						// autoFocus focuses during mount, so keys typed straight after Ctrl+K are not lost.
						autoFocus: true, className: "st_paletteInput", value: query, placeholder: t("palette.placeholder"),
						role: "combobox", "aria-expanded": true, onKeyDown,
						onChange: (e) => { setQuery(e.target.value); setIndex(0); },
					}),
					h("div", { ref: listRef, className: "st_paletteList", role: "listbox" }, rows.length ? rows : h("div", { className: "st_paletteEmpty" }, t("palette.nothing"))),
					h("div", { className: "st_paletteFoot" }, h("span", null, t("palette.footBrowse")), h("span", null, t("palette.footApply")), h("span", null, t("palette.footClose")))))
			: null,
		h(PromptFillDialog, { key: "fill" }),
		h(ExportDialog, { key: "export" }),
		toastText ? h("div", { key: "toast", className: "st_toast", role: "status" }, toastText) : null,
	];
}
//#endregion
