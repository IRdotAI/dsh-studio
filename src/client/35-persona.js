//#region AI preferences tab
function ModeSaver() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [emoji, setEmoji] = useState("✨");
	if (!open) return h(Button, { onClick: () => setOpen(true) }, t("modes.saveCurrent"));
	const save = () => { saveMode(name, emoji); setOpen(false); setName(""); };
	return h("div", { className: "st_row", style: { alignItems: "center" } },
		h("input", { className: "st_input", style: { width: 64 }, value: emoji, maxLength: 8, "aria-label": t("looks.emoji"), onChange: (e) => setEmoji(e.target.value) }),
		h("input", { className: "st_input", style: { flex: 1, minWidth: 160 }, value: name, autoFocus: true, maxLength: 40, placeholder: t("modes.namePlaceholder"), onChange: (e) => setName(e.target.value), onKeyDown: (e) => { if (e.key === "Enter") save(); } }),
		h(Button, { kind: "primary", onClick: save }, t("common.save")),
		h(Button, { onClick: () => setOpen(false) }, t("common.cancel")));
}

function ModesSection({ persona }) {
	const active = persona.enabled ? persona.mode : "";
	return h(Section, { title: t("modes.title"), description: t("modes.description"), actions: h(ModeSaver) },
		h("div", { className: "st_looks" },
			persona.modes.map((m) => h("div", { key: m.id, className: cls("st_lookCard", m.id === active && "st_lookCard_active") },
				h("span", { style: { fontSize: 20 }, "aria-hidden": true }, m.emoji),
				h("span", { className: "st_lookCardName", title: m.instructions }, modeName(m)),
				m.id === active
					? h("span", { className: "st_badge st_badge_accent" }, t("modes.active"))
					: h(Button, { small: true, kind: "primary", onClick: () => applyMode(m) }, t("common.apply")),
				h(Button, { small: true, kind: "danger", "aria-label": t("common.delete"), onClick: () => update({ persona: { modes: persona.modes.filter((x) => x.id !== m.id), ...(m.id === persona.mode ? { mode: "" } : {}) } }) }, "×")))),
		h("span", { className: "st_hint" }, t("modes.hint")));
}

function PersonaTab() {
	const state = useSnap((s) => s.state);
	const p = state.persona;
	// Editing a field by hand means the preferences no longer match the mode they came from.
	const set = (patch) => update({ persona: { ...patch, ...("style" in patch || "language" in patch || "instructions" in patch ? { mode: "" } : {}) } });
	const preview = personaPrompt({ ...state, persona: { ...p, enabled: true } });
	const styles = RESPONSE_STYLES.map((s) => ({ id: s.id, label: tOr("persona.style." + s.id, s.label) }));
	return [
		h(Section, { key: "on", title: t("persona.title"), description: t("persona.description") },
			h(Toggle, { checked: p.enabled, onChange: (v) => set({ enabled: v }), label: t("persona.enable"), hint: t("persona.enableHint") })),
		h(ModesSection, { key: "modes", persona: p }),
		h(Section, { key: "fields", title: t("persona.know") },
			h(Field, { label: t("persona.about"), hint: t("persona.aboutHint") },
				h(TextArea, { value: p.aboutMe, rows: 3, placeholder: t("persona.aboutPlaceholder"), onCommit: (v) => set({ aboutMe: v }) })),
			h("div", { className: "st_row" },
				h(Field, { label: t("persona.style"), hint: tOr("persona.styleHint." + p.style, "") || t("persona.noStyle") },
					h(Select, { value: p.style, options: styles, onChange: (v) => set({ style: v }) })),
				h(Field, { label: t("persona.language"), hint: t("persona.languageHint") },
					h(TextInput, { value: p.language, placeholder: t("persona.languagePlaceholder"), maxLength: 80, onCommit: (v) => set({ language: v }) }))),
			h(Field, { label: t("persona.instructions"), hint: t("persona.instructionsHint") },
				h(TextArea, { value: p.instructions, rows: 5, placeholder: t("persona.instructionsPlaceholder"), onCommit: (v) => set({ instructions: v }) }))),
		h(Section, { key: "preview", title: t("persona.previewTitle"), description: p.enabled ? t("persona.previewLive") : t("persona.previewOff") },
			h("pre", { className: "st_pre" }, preview || t("persona.previewEmpty"))),
	];
}
//#endregion
