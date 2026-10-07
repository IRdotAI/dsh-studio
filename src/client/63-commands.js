//#region slash commands
/**
 * True when the harness itself has a /name command in this session. DSH empties
 * the whole "/" menu when a plugin command shares a host command's name, so
 * Studio steps aside instead (the host catalog is loaded before this is asked).
 */
function hostHasCommand(commands, session, name) {
	try {
		return commands.directory?.entries?.get(session?.sessionId)?.commands?.some((c) => c.name === name) === true;
	} catch {
		return false;
	}
}

function registerCommands(scope) {
	const commands = scope.commandUi;
	const register = (spec, label) => scope.effect(() => commands.register({
		...spec,
		available: (session) => !hostHasCommand(commands, session, spec.name) && spec.available(session),
	}), label);

	register({
		name: "theme",
		label: () => t("command.theme"),
		description: () => t("command.themeDescription"),
		icon: PaletteIcon,
		available: () => true,
		ui: {
			kind: "popupSelect",
			searchMode: "fuzzy-label",
			searchLabels: () => ({ placeholder: t("command.themeSearch"), empty: t("command.themeEmpty"), noResults: t("command.themeNoResults") }),
			options: async () => [
				...themeChoices(snapshot.state).map((c) => ({
					id: c.id, label: `${c.emoji}  ${c.name}`, detail: c.description,
					active: snapshot.state.theme.active === c.id,
					group: { name: c.custom ? "custom" : "builtin", label: c.custom ? t("themes.yours") : t("tab.themes") },
				})),
				...snapshot.state.looks.map((l) => ({ id: "look:" + l.id, label: `${l.emoji}  ${l.name}`, group: { name: "looks", label: t("palette.group.looks") } })),
				{ id: "__surprise", label: "🎲  " + t("palette.surprise"), detail: t("palette.surpriseHint"), group: { name: "more", label: t("command.more") } },
			],
			onSelect: (option) => {
				if (option.id === "__surprise") surprise();
				else if (option.id.startsWith("look:")) applyTarget(option.id);
				else applyTheme(option.id);
			},
		},
	}, "dsh-studio: /theme");

	register({
		name: "prompts",
		label: () => t("composer.title"),
		description: () => t("command.promptsDescription"),
		icon: SparkIcon,
		available: () => snapshot.state.prompts.length > 0,
		ui: {
			kind: "popupSelect",
			searchMode: "fuzzy-label",
			searchLabels: () => ({ placeholder: t("command.promptsSearch"), empty: t("composer.none"), noResults: t("command.promptsNoResults") }),
			options: async () => snapshot.state.prompts.map((p) => ({
				id: p.id, label: p.title, detail: p.text.replace(/\s+/g, " ").slice(0, 120),
				...(p.folder ? { group: { name: "f:" + p.folder, label: p.folder } } : {}),
			})),
			onSelect: (option, session) => {
				const prompt = snapshot.state.prompts.find((p) => p.id === option.id);
				if (prompt) setTimeout(() => void insertPrompt(prompt, session?.sessionId), 0);
			},
		},
	}, "dsh-studio: /prompts");

	register({
		name: "studio",
		label: () => "Studio",
		description: () => t("command.studioDescription"),
		icon: PaletteIcon,
		available: () => true,
		ui: { kind: "action", run: () => openStudio() },
	}, "dsh-studio: /studio");

	register({
		name: "ai",
		label: () => t("command.mode"),
		description: () => t("command.modeDescription"),
		icon: SparkIcon,
		available: () => true,
		ui: {
			kind: "popupSelect",
			searchMode: "fuzzy-label",
			searchLabels: () => ({ placeholder: t("command.modeSearch"), empty: t("command.modeEmpty"), noResults: t("command.modeNoResults") }),
			options: async () => [
				...snapshot.state.persona.modes.map((m) => ({
					id: m.id, label: `${m.emoji}  ${modeName(m)}`, detail: m.instructions.slice(0, 120),
					active: snapshot.state.persona.enabled && snapshot.state.persona.mode === m.id,
				})),
				{ id: "__off", label: "⏻  " + t("command.modeOff"), detail: t("command.modeOffDetail"), active: !snapshot.state.persona.enabled },
			],
			onSelect: (option) => {
				if (option.id === "__off") modesOff();
				else {
					const mode = snapshot.state.persona.modes.find((m) => m.id === option.id);
					if (mode) applyMode(mode);
				}
			},
		},
	}, "dsh-studio: /ai");

	register({
		name: "transcript",
		label: () => t("command.export"),
		description: () => t("command.exportDescription"),
		icon: PaletteIcon,
		available: () => true,
		ui: { kind: "action", run: (session) => setSnap({ exportFor: session?.sessionId ?? currentSessionId() }) },
	}, "dsh-studio: /transcript");

	register({
		name: "focus",
		label: () => t("command.focus"),
		description: () => t("command.focusDescription"),
		icon: PaletteIcon,
		available: () => Boolean(services.layout),
		ui: { kind: "action", run: () => toggleFocus() },
	}, "dsh-studio: /focus");
}
//#endregion
