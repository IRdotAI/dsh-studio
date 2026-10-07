//#region Style tab
function StyleTab() {
	const state = useSnap((s) => s.state);
	const env = useSnap((s) => s.env);
	const focus = useSnap((s) => s.focus);
	const st = state.style;
	const wall = state.wallpaper;
	const set = (patch) => update({ style: patch });
	const uploadWallpaper = async () => {
		const file = await pickFile("image/*");
		if (!file) return;
		try {
			const src = await imageFileToDataUrl(file, 2400, "image/jpeg", 0.86);
			update({ wallpaper: { src } });
			toast(t("toast.wallpaperSet"));
		} catch (e) {
			toast(errorText(e));
		}
	};
	const fontOptions = UI_FONTS.map((f) => ({ id: f.id, label: tOr("font." + f.id, f.label) }));
	const codeOptions = CODE_FONTS.map((f) => ({ id: f.id, label: tOr("font." + f.id, f.label) }));
	return [
		h(Section, { key: "type", title: t("style.typography") },
			h("div", { className: "st_row" },
				h(Field, {
					label: t("style.uiFont"),
					hint: st.uiFont === "custom"
						? t("style.customFontHint")
						: st.uiFont === "folder"
							? (env.fontFaces.length ? t("style.folderServing", { count: env.fontFaces.length, weights: env.fontFaces.map((f) => f.weight).join(", ") }) : t("style.folderEmpty"))
							: t("style.fontHint"),
				},
					h(Select, { value: st.uiFont, options: fontOptions, onChange: (v) => set({ uiFont: v }) }),
					st.uiFont === "custom" ? h(TextInput, { value: st.uiFontCustom, placeholder: "\"My Font\", sans-serif", onCommit: (v) => set({ uiFontCustom: v }) }) : null,
					st.uiFont === "folder" ? h(TextInput, { value: st.fontDir, mono: true, placeholder: t("style.folderPlaceholder"), onCommit: (v) => set({ fontDir: v }) }) : null),
				h(Field, { label: t("style.codeFont") },
					h(Select, { value: st.codeFont, options: codeOptions, onChange: (v) => set({ codeFont: v }) }),
					st.codeFont === "custom" ? h(TextInput, { value: st.codeFontCustom, placeholder: "\"Iosevka\", monospace", onCommit: (v) => set({ codeFontCustom: v }) }) : null),
			),
		),
		h(Section, { key: "layout", title: t("layout.title"), description: t("layout.description") },
			h("div", { className: "st_row" },
				h(Field, { label: t("layout.chatWidth"), narrow: true, group: true },
					h(Segmented, { label: t("layout.chatWidth"), value: state.layout.chatWidth, options: CHAT_WIDTHS.map((w) => ({ id: w.id, label: t("width." + w.id) })), onChange: (v) => update({ layout: { chatWidth: v } }) })),
			),
			h("div", { className: "st_row" },
				h(Slider, { label: t("layout.scale"), value: state.layout.scale, min: 75, max: 140, step: 5, format: (v) => v + "%", onChange: (v) => update({ layout: { scale: v } }) }),
				h(Field, { label: t("layout.focus"), narrow: true, group: true },
					h(Button, { kind: focus ? "primary" : undefined, onClick: toggleFocus }, focus ? t("layout.focusExit") : t("layout.focusEnter"))),
			),
			h("span", { className: "st_hint" }, t("layout.hint")),
		),
		h(Section, { key: "shape", title: t("style.shape") },
			h("div", { className: "st_row" },
				h(Field, { label: t("style.corners"), narrow: true, group: true }, h(Segmented, { label: t("style.corners"), value: st.radius, options: RADII.map((r) => ({ id: r.id, label: t("radius." + r.id) })), onChange: (v) => set({ radius: v }) })),
			),
			h(Toggle, { checked: st.accentBubbles, onChange: (v) => set({ accentBubbles: v }), label: t("style.accentBubbles"), hint: t("style.accentBubblesHint") }),
			h(Toggle, { checked: st.accentSelection, onChange: (v) => set({ accentSelection: v }), label: t("style.accentSelection"), hint: t("style.accentSelectionHint") }),
		),
		h(Section, { key: "material", title: t("material.title"), description: t("material.description") },
			h(Segmented, { label: t("material.title"), value: st.material, options: MATERIALS.map((m) => ({ id: m.id, label: t("material." + m.id) })), onChange: (v) => set({ material: v }) }),
			st.material === "glass"
				? [
					h("div", { key: "sliders", className: "st_row" },
						h(Slider, { label: t("material.blur"), value: st.glassBlur, min: 0, max: 60, format: (v) => v + "px", onChange: (v) => set({ glassBlur: v }) }),
						h(Slider, { label: t("material.opacity"), value: st.glassOpacity, min: 5, max: 95, format: (v) => v + "%", onChange: (v) => set({ glassOpacity: v }) })),
					h(Toggle, { key: "sheen", checked: st.glassSheen, onChange: (v) => set({ glassSheen: v }), label: t("material.sheen"), hint: t("material.sheenHint") }),
					h("span", { key: "count", className: "st_hint" }, state.cache.glassSelectors.length ? t("material.found", { count: state.cache.glassSelectors.length }) : t("material.finding")),
				]
				: null,
		),
		h(Section, { key: "fx", title: t("ambience.title"), description: t("ambience.description") },
			h(Segmented, { label: t("ambience.title"), value: st.ambience, options: AMBIENCES.map((a) => ({ id: a.id, label: t("ambience." + a.id) })), onChange: (v) => set({ ambience: v }) }),
			st.ambience !== "none"
				? h("div", { className: "st_row" },
					h(Slider, { label: t("ambience.strength"), value: st.ambienceStrength, min: 5, max: 100, step: 5, format: (v) => v + "%", onChange: (v) => set({ ambienceStrength: v }) }),
					st.ambience === "aurora" ? h(Toggle, { checked: st.animate, onChange: (v) => set({ animate: v }), label: t("ambience.drift"), hint: t("ambience.driftHint") }) : null)
				: null,
		),
		h(Section, {
			key: "wall",
			title: t("wallpaper.title"),
			description: t("wallpaper.description"),
			actions: h("div", { className: "st_actions" },
				env.desktopWallpaper ? h(Button, { onClick: () => update({ wallpaper: { src: DESKTOP_WALLPAPER } }) }, t("wallpaper.useDesktop")) : null,
				h(Button, { onClick: uploadWallpaper }, t("wallpaper.upload")),
				wall.src ? h(Button, { kind: "danger", onClick: () => update({ wallpaper: { src: "" } }) }, t("common.remove")) : null),
		},
			h("div", { className: "st_row", style: { alignItems: "center" } },
				wall.src ? h("div", { className: "st_wallThumb", style: { backgroundImage: `url("${(wall.src === DESKTOP_WALLPAPER ? DESKTOP_WALLPAPER_URL : wall.src).replace(/"/g, "")}")` } }) : null,
				wall.src === DESKTOP_WALLPAPER
					? h("span", { className: "st_hint", style: { flex: 1 } }, t("wallpaper.followingDesktop"))
					: h(Field, { label: t("wallpaper.url"), hint: t("wallpaper.urlHint") },
						h(TextInput, { value: wall.src.startsWith("data:") ? "" : wall.src, placeholder: "https://…", onCommit: (v) => update({ wallpaper: { src: v.trim() } }) })),
			),
			wall.src
				? h("div", { className: "st_row" },
					h(Slider, { label: t("wallpaper.visibility"), value: wall.strength, min: 5, max: 80, format: (v) => v + "%", onChange: (v) => update({ wallpaper: { strength: v } }) }),
					h(Slider, { label: t("wallpaper.blur"), value: wall.blur, min: 0, max: 40, format: (v) => v + "px", onChange: (v) => update({ wallpaper: { blur: v } }) }))
				: null,
		),
	];
}
//#endregion
