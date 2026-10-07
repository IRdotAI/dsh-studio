//#region Themes tab
function LookSaver() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [emoji, setEmoji] = useState("✨");
	if (!open) return h(Button, { onClick: () => setOpen(true) }, t("looks.saveCurrent"));
	return h("div", { className: "st_row", style: { alignItems: "center" } },
		h("input", { className: "st_input", style: { width: 64 }, value: emoji, maxLength: 8, "aria-label": t("looks.emoji"), onChange: (e) => setEmoji(e.target.value) }),
		h("input", { className: "st_input", style: { flex: 1, minWidth: 160 }, value: name, autoFocus: true, maxLength: 40, placeholder: t("looks.namePlaceholder"), onChange: (e) => setName(e.target.value),
			onKeyDown: (e) => { if (e.key === "Enter") { saveLook(name, emoji); setOpen(false); setName(""); } } }),
		h(Button, { kind: "primary", onClick: () => { saveLook(name, emoji); setOpen(false); setName(""); } }, t("common.save")),
		h(Button, { onClick: () => setOpen(false) }, t("common.cancel")));
}

function LooksSection({ state }) {
	return h(Section, { title: t("looks.title"), description: t("looks.description"), actions: h(LookSaver) },
		state.looks.length
			? h("div", { className: "st_looks" }, state.looks.map((look) => h("div", { key: look.id, className: "st_lookCard" },
				h("span", { style: { fontSize: 20 } }, look.emoji),
				h("span", { className: "st_lookCardName", title: look.name }, look.name),
				h(Button, { small: true, kind: "primary", onClick: () => applyUserLook(look) }, t("common.apply")),
				h(Button, { small: true, kind: "danger", "aria-label": t("common.delete"), onClick: () => update({ looks: state.looks.filter((l) => l.id !== look.id) }) }, "×"))))
			: h("p", { className: "st_hint" }, t("looks.empty")));
}

/** Parse "51.5, -0.12" into a location, or null. */
function parseLocation(text) {
	const m = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
	if (!m) return null;
	const lat = Number(m[1]);
	const lon = Number(m[2]);
	return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

function ScheduleSection({ state }) {
	const sched = state.schedule;
	const loc = sched.location;
	const targets = scheduleTargets(state);
	const setEntries = (entries) => update({ schedule: { entries, applied: "" } });
	const setEntry = (i, patch) => setEntries(sched.entries.map((x, j) => (j === i ? { ...x, ...patch } : x)));
	const addEntry = () => {
		const used = new Set(sched.entries.map((e) => e.time));
		const time = ["sunrise", "sunset", "07:00", "19:00", "12:00", "22:00"].find((x) => !used.has(x)) ?? "09:00";
		setEntries([...sched.entries, { time, target: targets[0]?.id ?? "theme:default" }]);
	};
	const kinds = [{ id: "time", label: t("schedule.atTime") }, { id: "sunrise", label: "🌅 " + t("schedule.sunrise") }, { id: "sunset", label: "🌇 " + t("schedule.sunset") }];
	const usesSun = sched.entries.some((e) => e.time === "sunrise" || e.time === "sunset");
	const sun = loc.lat != null ? sunTimes(new Date(), loc.lat, loc.lon) : null;
	const clock = (d) => d.toLocaleTimeString(snapshot.lang, { hour: "2-digit", minute: "2-digit" });
	const setLocation = (location) => update({ schedule: { location, applied: "" } });
	const locate = () => {
		if (!navigator.geolocation) return toast(t("schedule.locateFailed"));
		navigator.geolocation.getCurrentPosition(
			(pos) => { setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }); toast(t("schedule.located")); },
			() => toast(t("schedule.locateFailed")),
			{ maximumAge: 3_600_000, timeout: 15_000 },
		);
	};
	return h(Section, { title: t("schedule.title"), description: t("schedule.description") },
		h(Toggle, { checked: sched.enabled, onChange: (v) => update({ schedule: { enabled: v, applied: "" } }), label: t("schedule.enable"), hint: t("schedule.hint") }),
		sched.entries.map((entry, i) => {
			const fixed = entry.time !== "sunrise" && entry.time !== "sunset";
			return h("div", { key: i, className: "st_schedRow" },
				h("span", { className: "st_label" }, t("schedule.from")),
				h(Select, { value: fixed ? "time" : entry.time, options: kinds, onChange: (k) => setEntry(i, { time: k === "time" ? "07:00" : k }) }),
				fixed ? h("input", { type: "time", className: "st_input", value: entry.time, "aria-label": t("schedule.time"), onChange: (e) => { if (e.target.value) setEntry(i, { time: e.target.value }); } }) : null,
				h("span", { className: "st_label" }, t("schedule.use")),
				h(Select, { value: entry.target, options: targets, onChange: (v) => setEntry(i, { target: v }) }),
				h(Button, { small: true, kind: "danger", "aria-label": t("common.delete"), onClick: () => setEntries(sched.entries.filter((_, j) => j !== i)) }, "×"));
		}),
		h("div", { className: "st_actions" }, h(Button, { onClick: addEntry }, t("schedule.add"))),
		usesSun || loc.lat != null
			? h("div", { className: "st_schedLocation" },
				h("span", { className: "st_hint", style: { flex: "1 1 260px" } },
					loc.lat == null
						? t("schedule.noLocation", { sunrise: SUN_FALLBACK.sunrise, sunset: SUN_FALLBACK.sunset })
						: sun?.polar
							? t("schedule.polar")
							: t("schedule.locationSet", { lat: loc.lat, lon: loc.lon, sunrise: clock(sun.sunrise), sunset: clock(sun.sunset) })),
				h(Button, { small: true, onClick: locate }, "📍 " + t("schedule.locate")),
				h(TextInput, { value: loc.lat == null ? "" : `${loc.lat}, ${loc.lon}`, placeholder: t("schedule.latLon"), onCommit: (v) => { const p = parseLocation(v); if (p) setLocation(p); else if (!v.trim()) setLocation({ lat: null, lon: null }); } }))
			: null);
}

/** Give each workspace its own theme or look, shown whenever it's open. */
function WorkspaceSection({ state }) {
	const ws = useSnap((s) => s.workspace);
	const targets = [{ id: "", label: t("workspaces.normal") }, ...scheduleTargets(state)];
	const set = (id, target) => update({ workspaceThemes: { [id]: target } }); // "" is dropped by the validator
	return h(Section, { title: t("workspaces.title"), description: t("workspaces.description") },
		ws.list.length
			? ws.list.map((w) => h("div", { key: w.id, className: "st_wsRow" },
				h("span", { className: "st_wsName", title: workspaceLabel(w.title) }, "📁 ", workspaceLabel(w.title)),
				w.id === ws.id ? h("span", { className: "st_badge st_badge_accent" }, t("workspaces.open")) : null,
				h(Select, { value: state.workspaceThemes[w.id] ?? "", options: targets, onChange: (v) => set(w.id, v) })))
			: h("p", { className: "st_hint" }, t("workspaces.none")));
}

function ThemesTab() {
	const state = useSnap((s) => s.state);
	const themeSnap = useSnap((s) => s.themeSnap);
	const env = useSnap((s) => s.env);
	const workspace = useSnap((s) => s.workspace);
	const choices = themeChoices(state);
	const builtIn = choices.filter((c) => !c.custom);
	const custom = choices.filter((c) => c.custom);
	const wsTarget = workspaceTarget(state, workspace.id);
	return [
		wsTarget
			? h("div", { key: "ws-note", className: "st_banner st_bannerInfo" },
				t("workspaces.overrideNote", { workspace: workspaceLabel(workspace.title), name: scheduleTargets(state).find((x) => x.id === wsTarget)?.label ?? wsTarget }))
			: null,
		...LOOKS.map((look) => h("div", { key: "look:" + look.id, className: "st_look" },
			h("span", { style: { fontSize: 28 }, "aria-hidden": true }, "🫧"),
			h("div", { className: "st_lookText" },
				h("div", { className: "st_lookTitle" }, tOr("look." + look.id, look.name)),
				h("div", { className: "st_lookDesc" }, tOr("lookDesc." + look.id, look.description))),
			h(Button, { kind: "primary", onClick: () => applyBuiltinLook(look) }, t("looks.matchDesktop")))),
		h(Section, { key: "mode", title: t("appearance.title"), description: t("appearance.description") },
			h("div", { className: "st_row" },
				services.theme && themeSnap
					? h(Field, { label: t("appearance.mode"), narrow: true, group: true },
						h(Segmented, {
							label: t("appearance.mode"),
							value: themeSnap.preference,
							options: [{ id: "light", label: "☀️ " + t("appearance.light") }, { id: "dark", label: "🌙 " + t("appearance.dark") }, { id: "system", label: "💻 " + t("appearance.system") }],
							onChange: setAppearance,
						}))
					: null,
				services.theme && themeSnap
					? h(Field, { label: t("appearance.textSize"), narrow: true, group: true },
						h("div", { className: "st_row", style: { gap: 6, alignItems: "center" } },
							h(Button, { small: true, onClick: () => bumpFontSize(-1), "aria-label": t("appearance.smaller") }, "A−"),
							h("span", { className: "st_label", style: { minWidth: 36, textAlign: "center" } }, `${themeSnap.fontSize}px`),
							h(Button, { small: true, onClick: () => bumpFontSize(1), "aria-label": t("appearance.larger") }, "A+")))
					: null,
				h(Slider, { label: t("appearance.tint"), value: Math.round(state.theme.tint * 100), min: 0, max: 200, step: 5, format: (v) => (v === 0 ? t("appearance.grey") : `${v}%`), onChange: (v) => update({ theme: { tint: v / 100 } }) }),
			),
			env.windowsAccent
				? h("div", { className: "st_row", style: { alignItems: "center" } },
					h(Toggle, { checked: state.followWindows.accent, onChange: (v) => update({ followWindows: { accent: v } }), label: h("span", null, t("windows.accent"), " ", h(Swatch, { color: env.windowsAccent })), hint: t("windows.accentHint") }),
					h(Button, { onClick: () => setAppearance("system") }, t("windows.matchMode")))
				: null,
		),
		h(Section, {
			key: "presets",
			title: t("themes.title"),
			description: t("themes.description"),
			actions: h("div", { className: "st_actions" },
				h(Button, { onClick: surprise }, t("themes.surprise")),
				h(Button, { onClick: () => setSnap({ tab: "editor" }) }, t("themes.makeOwn")),
				h(Button, { onClick: () => setSnap({ tab: "gallery" }) }, t("themes.browseGallery"))),
		},
			h("div", { className: "st_grid" }, builtIn.map((c) => h(ThemeCard, { key: c.id, choice: c, active: state.theme.active === c.id, onPick: () => applyTheme(c.id) })))),
		custom.length
			? h(Section, { key: "custom", title: t("themes.yours"), description: t("themes.yoursDescription") },
				h("div", { className: "st_grid" }, custom.map((c) => h(ThemeCard, { key: c.id, choice: c, active: state.theme.active === c.id, onPick: () => applyTheme(c.id) }))))
			: null,
		h(LooksSection, { key: "looks", state }),
		h(ScheduleSection, { key: "schedule", state }),
		h(WorkspaceSection, { key: "workspaces", state }),
	];
}
//#endregion
