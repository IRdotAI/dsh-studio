//#region Gallery tab
function GalleryTab() {
	const state = useSnap((s) => s.state);
	const [gallery, setGallery] = useState(null);
	const [loading, setLoading] = useState(false);
	const load = async (refresh) => {
		setLoading(true);
		try {
			setGallery(refresh ? await apiPost("gallery", {}) : await apiGet("gallery"));
		} catch (e) {
			setGallery({ themes: [], error: errorText(e) });
		} finally {
			setLoading(false);
		}
	};
	useEffect(() => { void load(false); }, []);

	/** Gallery themes are stored as custom themes with a "g_" id, so adding twice just re-applies. */
	const add = (theme) => {
		const id = ("g_" + theme.id).slice(0, 40);
		const entry = { id, name: theme.name, dark: theme.dark, light: theme.light };
		const others = state.customThemes.filter((c) => c.id !== id);
		update({ customThemes: [...others, entry], theme: { active: "custom:" + id } });
		toast(t("toast.theme", { name: theme.name }));
	};

	const themes = gallery?.themes ?? [];
	return [
		h(Section, {
			key: "gallery",
			title: t("gallery.title"),
			description: t("gallery.description"),
			actions: h(Button, { disabled: loading, onClick: () => void load(true) }, loading ? t("common.loading") : t("common.refresh")),
		},
			gallery?.error ? h("p", { className: "st_creditLine" }, gallery.error) : null,
			!gallery ? h("p", { className: "st_hint" }, t("common.loading")) : null,
			gallery && !themes.length && !gallery.error ? h("p", { className: "st_hint" }, t("gallery.empty")) : null,
			themes.length
				? h("div", { className: "st_grid" }, themes.map((theme) => {
					const id = "custom:" + ("g_" + theme.id).slice(0, 40);
					const choice = { id, name: theme.name, emoji: theme.emoji, description: theme.description, theme };
					return h(ThemeCard, {
						key: theme.id, choice, active: state.theme.active === id, onPick: () => add(theme),
						footer: theme.author || theme.description ? h("div", { className: "st_cardAuthor" }, [theme.author ? t("gallery.by", { author: theme.author }) : "", theme.description].filter(Boolean).join(" · ")) : null,
					});
				}))
				: null,
		),
		h(Section, { key: "submit", title: t("gallery.submitTitle"), description: t("gallery.submitDescription") },
			h("div", { className: "st_actions" },
				h(Button, { kind: "primary", onClick: () => setSnap({ tab: "editor" }) }, t("gallery.openEditor")),
				h("a", { className: "st_btn", href: REPO_URL + "/tree/main/gallery", target: "_blank", rel: "noopener noreferrer" }, t("gallery.howTo")))),
	];
}
//#endregion
