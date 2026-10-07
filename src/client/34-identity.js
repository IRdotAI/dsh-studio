//#region Identity tab
function IdentityTab() {
	const state = useSnap((s) => s.state);
	const id = state.identity;
	const set = (patch) => update({ identity: patch });
	// The logo only switches to "Image" once a file is actually chosen; cancelling changes nothing.
	const uploadMark = async () => {
		const file = await pickFile("image/*");
		if (!file) return;
		try {
			set({ mark: "image", markImage: await imageFileToDataUrl(file, 128, "image/png") });
		} catch (e) {
			toast(errorText(e));
		}
	};
	const removeMarkImage = () => {
		set({ mark: "default", markImage: "" });
		toast(t("identity.imageRemoved"));
	};
	const pickMark = (mark) => {
		if (mark === "image" && !id.markImage) void uploadMark();
		else set({ mark });
	};
	return [
		h(Section, { key: "you", title: t("identity.you"), description: t("identity.youDescription") },
			h("div", { className: "st_row" },
				h(Field, { label: t("identity.name") }, h(TextInput, { value: id.name, placeholder: t("identity.namePlaceholder"), maxLength: 80, onCommit: (v) => set({ name: v }) })))),
		h(Section, { key: "brand", title: t("identity.brandTitle"), description: t("identity.brandDescription") },
			h("div", { className: "st_row" },
				h(Field, { label: t("identity.appName") }, h(TextInput, { value: id.appName, placeholder: t("identity.appNamePlaceholder"), maxLength: 80, onCommit: (v) => set({ appName: v }) })),
				h(Field, { label: t("identity.logo"), narrow: true, group: true },
					h(Segmented, {
						label: t("identity.logo"), value: id.mark, onChange: pickMark,
						options: [{ id: "default", label: t("identity.logoOriginal") }, { id: "emoji", label: t("identity.logoEmoji") }, { id: "monogram", label: t("identity.logoMonogram") }, { id: "image", label: t("identity.logoImage") }],
					})),
			),
			id.mark === "emoji" ? h(Field, { label: t("identity.logoEmoji"), narrow: true }, h(TextInput, { value: id.markEmoji, maxLength: 16, onCommit: (v) => set({ markEmoji: v }) })) : null,
			id.mark === "monogram" ? h(Field, { label: t("identity.letters"), narrow: true, hint: t("identity.lettersHint") }, h(TextInput, { value: id.markText, maxLength: 3, onCommit: (v) => set({ markText: v }) })) : null,
			id.mark === "image" && id.markImage
				? h("div", { className: "st_row", style: { alignItems: "center", gap: 14 } },
					h("div", { className: "st_markThumb" },
						h("img", { src: id.markImage, alt: t("identity.logoImage") }),
						h("button", { type: "button", className: "st_markRemove", onClick: removeMarkImage, title: t("identity.removeImage"), "aria-label": t("identity.removeImage") }, "×")),
					h(Button, { onClick: uploadMark }, t("identity.differentImage")))
				: null,
			h("div", { className: "st_identityPreview" },
				h(MarkPreview, { identity: id, size: 24 }),
				h("span", { className: "st_brandName" }, id.appName || "DeepSeek Harness")),
		),
		h(Section, { key: "greet", title: t("identity.greetingTitle"), description: t("identity.greetingDescription") },
			h(Toggle, { checked: id.greeting, onChange: (v) => set({ greeting: v }), label: t("identity.greetingEnable") }),
			id.greeting
				? [
					h(Field, { key: "tpl", label: t("identity.template"), hint: t("identity.templateHint") },
						h(TextInput, { value: id.greetingTemplate, maxLength: 160, onCommit: (v) => set({ greetingTemplate: v }) })),
					h("div", { key: "pv", className: "st_greetPreview" }, renderGreeting(state, new Date(), greetingLang())),
				]
				: null,
			h(Toggle, { checked: id.hideBadge, onChange: (v) => set({ hideBadge: v }), label: t("identity.hideBadge") }),
		),
	];
}
//#endregion
