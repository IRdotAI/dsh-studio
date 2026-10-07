//#region AI preferences tab
function PersonaTab() {
	const state = useSnap((s) => s.state);
	const p = state.persona;
	const set = (patch) => update({ persona: patch });
	const preview = personaPrompt({ ...state, persona: { ...p, enabled: true } });
	const styles = RESPONSE_STYLES.map((s) => ({ id: s.id, label: tOr("persona.style." + s.id, s.label) }));
	return [
		h(Section, { key: "on", title: t("persona.title"), description: t("persona.description") },
			h(Toggle, { checked: p.enabled, onChange: (v) => set({ enabled: v }), label: t("persona.enable"), hint: t("persona.enableHint") })),
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
