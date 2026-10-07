//#region page
const TABS = [
	{ id: "themes", component: ThemesTab },
	{ id: "editor", component: EditorTab },
	{ id: "gallery", component: GalleryTab },
	{ id: "style", component: StyleTab },
	{ id: "identity", component: IdentityTab },
	{ id: "persona", component: PersonaTab },
	{ id: "prompts", component: PromptsTab },
	{ id: "alerts", component: AlertsTab },
	{ id: "usage", component: UsageTab },
	{ id: "sync", component: SyncTab },
	{ id: "advanced", component: AdvancedTab },
	{ id: "updates", component: UpdatesTab },
	{ id: "credits", component: CreditsTab },
];

function LanguagePicker() {
	const language = useSnap((s) => s.state.language);
	const options = [{ id: "auto", label: "🌐 " + t("language.auto") }, ...LANGUAGES.map((l) => ({ id: l.code, label: l.name }))];
	return h("select", {
		className: "st_input st_langSelect", value: language, "aria-label": t("language.label"), title: t("language.label"),
		onChange: (e) => { update({ language: e.target.value }); setTimeout(syncLanguage, 0); },
	}, options.map((o) => h("option", { key: o.id, value: o.id }, o.label)));
}

function StudioPage() {
	useT();
	const loaded = useSnap((s) => s.loaded);
	const error = useSnap((s) => s.error);
	const tab = useSnap((s) => s.tab);
	const lang = useSnap((s) => s.lang);
	const current = TABS.find((x) => x.id === tab) ?? TABS[0];
	return h("div", { className: "st_page", dir: langDir(lang), lang },
		h("div", { className: "st_inner" },
			h("div", { className: "st_head" },
				h("div", null,
					h("h1", { className: "st_title" }, h("span", { className: "st_titleMark" }, h(PaletteIcon, { size: 18 })), "Studio"),
					h("p", { className: "st_sub" }, t("page.subtitle"), " ", h("span", { className: "st_kbd" }, "Ctrl K"), " ", t("page.paletteHint"))),
				h("div", { className: "st_headRight" }, h(LanguagePicker))),
			h(UpdateBanner),
			h("div", { className: "st_tabs", role: "tablist" },
				TABS.map((x) => h("button", { key: x.id, type: "button", role: "tab", className: "st_tab", "aria-selected": x.id === current.id, onClick: () => setSnap({ tab: x.id }) }, t("tab." + x.id)))),
			error ? h("div", { className: "st_banner" }, error) : null,
			loaded ? h(current.component, { key: current.id }) : h("p", { className: "st_hint" }, t("common.loading")),
		),
	);
}
//#endregion
