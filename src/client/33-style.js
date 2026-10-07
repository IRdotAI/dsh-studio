//#region Style tab
function StyleTab() {
	const state = useSnap((s) => s.state);
	const env = useSnap((s) => s.env);
	const focus = useSnap((s) => s.focus);
	const st = state.style;
	const wall = state.wallpaper;
	const set = (patch) => update({ style: patch });
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
							: st.uiFont === "readable" ? t("a11y.readableHint") : t("style.fontHint"),
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
		h(WallpaperSection, { key: "wall", wall, env }),
		h(AccessibilitySection, { key: "a11y", state }),
	];
}

const WALL_INTERVALS = [1, 5, 15, 30, 60, 180, 1440];

function WallpaperSection({ wall, env }) {
	const set = (patch) => update({ wallpaper: patch });
	const kind = !wall.src ? "none" : WALLPAPER_SOURCES.includes(wall.src) ? wall.src : "image";
	const uploadWallpaper = async () => {
		const file = await pickFile("image/*");
		if (!file) return;
		try {
			set({ src: await imageFileToDataUrl(file, 2400, "image/jpeg", 0.86) });
			toast(t("toast.wallpaperSet"));
		} catch (e) {
			toast(errorText(e));
		}
	};
	const pick = (next) => {
		if (next === "image") { if (kind !== "image") void uploadWallpaper(); return; }
		set({ src: next === "none" ? "" : next });
		// The host fetches Bing's picture and counts the slideshow on demand; refresh what it reports.
		if (next === "bing" || next === "folder" || next === "video") for (const ms of [800, 4000]) setTimeout(refreshEnv, ms);
	};
	const kinds = [
		{ id: "none", label: t("wallpaper.none") },
		{ id: "image", label: "🖼️ " + t("wallpaper.image") },
		...(env.desktopWallpaper ? [{ id: "desktop", label: "🖥️ " + t("wallpaper.desktop") }] : []),
		{ id: "bing", label: "🌍 " + t("wallpaper.bing") },
		{ id: "folder", label: "🎞️ " + t("wallpaper.folder") },
		{ id: "video", label: "🎬 " + t("wallpaper.video") },
	];
	const thumb = kind !== "none" && kind !== "video" ? wallpaperUrl(wall, new Date(), slideIndex(env.wallpaperCount ?? 0, wall.interval)) : "";
	return h(Section, { title: t("wallpaper.title"), description: t("wallpaper.description") },
		h(Segmented, { label: t("wallpaper.title"), value: kind, options: kinds, onChange: pick }),
		h("div", { className: "st_row", style: { alignItems: "center" } },
			thumb ? h("div", { className: "st_wallThumb", style: { backgroundImage: `url("${thumb.replace(/"/g, "")}")` } }) : null,
			kind === "image"
				? h(Field, { label: t("wallpaper.url"), hint: t("wallpaper.urlHint") },
					h("div", { className: "st_row", style: { gap: 8 } },
						h(TextInput, { value: wall.src.startsWith("data:") ? "" : wall.src, placeholder: "https://…", onCommit: (v) => set({ src: v.trim() }) }),
						h(Button, { onClick: uploadWallpaper }, t("wallpaper.upload"))))
				: kind === "desktop"
					? h("span", { className: "st_hint", style: { flex: 1 } }, t("wallpaper.followingDesktop"))
					: kind === "bing"
						? h("span", { className: "st_hint", style: { flex: 1 } }, env.bing ? t("wallpaper.bingToday", { title: env.bing.title || env.bing.copyright, copyright: env.bing.copyright }) : t("wallpaper.bingHint"))
						: kind === "folder"
							? h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 8 } },
								h(Field, { label: t("wallpaper.folderPath"), hint: wall.folder ? t("wallpaper.folderCount", { count: env.wallpaperCount ?? 0 }) : t("wallpaper.folderHint") },
									h(TextInput, { value: wall.folder, mono: true, placeholder: "C:\\Users\\…\\Pictures\\Wallpapers", onCommit: (v) => { set({ folder: v.trim() }); setTimeout(refreshEnv, 300); } })),
								h(Field, { label: t("wallpaper.interval"), narrow: true },
									h(Select, { value: String(wall.interval), options: WALL_INTERVALS.map((m) => ({ id: String(m), label: m < 60 ? t("wallpaper.everyMinutes", { n: m }) : m < 1440 ? t("wallpaper.everyHours", { n: m / 60 }) : t("wallpaper.everyDay") })), onChange: (v) => set({ interval: Number(v) }) })))
							: kind === "video"
								? h(Field, { label: t("wallpaper.videoPath"), hint: wall.video && !/^https?:/i.test(wall.video) && !env.videoFound ? t("wallpaper.videoMissing") : t("wallpaper.videoHint") },
									h(TextInput, { value: wall.video, mono: true, placeholder: "C:\\Videos\\rain.mp4  /  https://…/loop.mp4", onCommit: (v) => { set({ video: v.trim() }); setTimeout(refreshEnv, 300); } }))
								: null,
		),
		kind !== "none"
			? h("div", { className: "st_row" },
				h(Slider, { label: t("wallpaper.visibility"), value: wall.strength, min: 5, max: 80, format: (v) => v + "%", onChange: (v) => set({ strength: v }) }),
				h(Slider, { label: t("wallpaper.blur"), value: wall.blur, min: 0, max: 40, format: (v) => v + "px", onChange: (v) => set({ blur: v }) }))
			: null,
	);
}

function AccessibilitySection({ state }) {
	const st = state.style;
	const set = (patch) => update({ style: patch });
	const highContrast = state.theme.active === "high-contrast";
	return h(Section, { title: t("a11y.title"), description: t("a11y.description") },
		h(Toggle, { checked: st.reduceTransparency, onChange: (v) => set({ reduceTransparency: v }), label: t("a11y.reduceTransparency"), hint: systemReducesTransparency() ? t("a11y.reduceTransparencySystem") : t("a11y.reduceTransparencyHint") }),
		h(Toggle, { checked: st.focusRings || highContrast, disabled: highContrast, onChange: (v) => set({ focusRings: v }), label: t("a11y.focusRings"), hint: t("a11y.focusRingsHint") }),
		h(Toggle, { checked: st.uiFont === "readable", onChange: (v) => set({ uiFont: v ? "readable" : "default" }), label: t("a11y.readable"), hint: t("a11y.readableHint") }),
		h("div", { className: "st_actions" },
			h(Button, { kind: highContrast ? "primary" : undefined, onClick: () => applyTheme(highContrast ? "default" : "high-contrast") }, highContrast ? t("a11y.highContrastOff") : "🔳 " + t("a11y.highContrastOn"))));
}
//#endregion
