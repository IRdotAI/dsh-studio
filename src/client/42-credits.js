//#region Credits tab
/** The open-source colour schemes some presets are adapted from. */
const PALETTE_CREDITS = [
	{ name: "Dracula", by: "Zeno Rocha and contributors", url: "https://draculatheme.com" },
	{ name: "Nord", by: "Sven Greb (Arctic Ice Studio)", url: "https://www.nordtheme.com" },
	{ name: "Catppuccin", by: "the Catppuccin community", url: "https://catppuccin.com" },
	{ name: "Gruvbox", by: "Pavel Pertsev (morhetz)", url: "https://github.com/morhetz/gruvbox" },
	{ name: "Solarized", by: "Ethan Schoonover", url: "https://ethanschoonover.com/solarized/" },
	{ name: "Tokyo Night", by: "enkia", url: "https://github.com/enkia/tokyo-night-vscode-theme" },
	{ name: "Rosé Pine", by: "the Rosé Pine team", url: "https://rosepinetheme.com" },
];

function CreditsTab() {
	const adapted = new Set(PALETTE_CREDITS.map((c) => c.name));
	const originals = PRESETS.filter((p) => !adapted.has(p.name)).map((p) => `${p.emoji} ${p.name}`);
	return [
		h("div", { key: "hero", className: "st_creditHero" },
			h("span", { className: "st_creditMark", "aria-hidden": true }, h(PaletteIcon, { size: 30 })),
			h("div", { className: "st_creditText" },
				h("div", { className: "st_creditTitle" }, "Studio ", h("span", { className: "st_creditVersion" }, "v" + STUDIO_VERSION)),
				h("div", { className: "st_creditBy" }, t("credits.madeBy"), " ", h("strong", null, "RdotA")),
				h("div", { className: "st_hint" }, t("credits.tagline"))),
			h("div", { className: "st_actions" },
				h("a", { className: "st_btn st_btn_primary", href: REPO_URL, target: "_blank", rel: "noopener noreferrer" }, t("credits.github")),
				h("a", { className: "st_btn", href: REPO_URL + "/issues", target: "_blank", rel: "noopener noreferrer" }, t("credits.report")))),
		h(Section, { key: "built", title: t("credits.builtOn") },
			h("p", { className: "st_creditLine" }, h(ExternalLink, { href: "https://github.com/deepseek-ai/deepseek-harness" }, "DeepSeek Harness"), " ", t("credits.builtOnText"))),
		h(Section, { key: "palettes", title: t("credits.palettes"), description: t("credits.palettesDescription") },
			h("div", null, PALETTE_CREDITS.map((c) => h("div", { key: c.name, className: "st_creditRow" },
				h("span", { className: "st_creditName" }, c.name),
				h("span", { className: "st_hint", style: { flex: 1 } }, c.by),
				h(ExternalLink, { href: c.url }, t("credits.website") + " ↗")))),
			h("p", { className: "st_creditLine" }, t("credits.originals"), " ", originals.join(" · "), ".")),
		h(Section, { key: "translations", title: t("credits.translationsTitle") },
			h("p", { className: "st_creditLine" }, t("credits.translationsText"), " ", h(ExternalLink, { href: REPO_URL + "/tree/main/locales" }, "locales/ ↗"))),
		h(Section, { key: "licence", title: t("credits.licence") },
			h("p", { className: "st_creditLine" }, t("credits.licenceText"), " ", h(ExternalLink, { href: REPO_URL + "/blob/main/LICENSE" }, t("credits.readLicence") + " ↗"))),
	];
}
//#endregion
