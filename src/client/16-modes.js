//#region AI modes
/** A mode's display name: the starter modes are translated, your own keep their name. */
const modeName = (m) => tOr("mode." + m.id, m.name);

/** Switch to a saved mode: its style, language and instructions become the active preferences. */
function applyMode(mode, quiet) {
	update({ persona: { enabled: true, style: mode.style, language: mode.language, instructions: mode.instructions, mode: mode.id } });
	if (!quiet) toast(t("toast.mode", { name: `${mode.emoji} ${modeName(mode)}` }));
}

/** Turn the AI preferences off (the fields are kept for next time). */
function modesOff() {
	update({ persona: { enabled: false, mode: "" } });
	toast(t("toast.modeOff"));
}

/** Save the current style, language and instructions as a new mode. */
function saveMode(name, emoji) {
	const p = snapshot.state.persona;
	const mode = { id: "m_" + Date.now().toString(36), name: name.trim() || t("modes.untitled"), emoji: emoji || "✨", style: p.style, language: p.language, instructions: p.instructions };
	update({ persona: { modes: [...p.modes, mode], mode: mode.id, enabled: true } });
	toast(t("toast.modeSaved", { name: mode.name }));
}
//#endregion
