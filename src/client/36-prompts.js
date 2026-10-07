//#region Prompts tab
/** Prompts grouped by folder, unfiled first, folders alphabetically. */
function groupPrompts(prompts) {
	const groups = new Map();
	for (const p of prompts) {
		const key = p.folder || "";
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(p);
	}
	return [...groups.entries()].sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
}

/** Open GitHub's "new file" page with these prompts as a gallery pack, ready to propose. */
function submitPackToGallery(prompts, name) {
	const slug = (name || "prompts").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "prompts";
	const pack = { id: slug, name: name || t("prompts.packDefaultName"), emoji: "✦", author: snapshot.state.identity.name || "", description: "", prompts: prompts.map(({ title, text, folder }) => ({ title, text, folder })) };
	const repo = REPO_URL.replace("https://github.com/", "");
	const json = JSON.stringify(pack, null, 2) + "\n";
	const base = `https://github.com/${repo}/new/main/gallery/prompts?filename=${encodeURIComponent(slug + ".json")}`;
	const full = `${base}&value=${encodeURIComponent(json)}`;
	// GitHub refuses very long links, so a big pack goes through the clipboard instead.
	if (full.length <= 7000) return void window.open(full, "_blank", "noopener");
	void navigator.clipboard?.writeText(json).then(() => toast(t("prompts.packCopied")), () => toast(t("export.copyFailed")));
	window.open(base, "_blank", "noopener");
}

function PackSubmitter({ prompts, folders }) {
	const [folder, setFolder] = useState("*");
	const chosen = folder === "*" ? prompts : prompts.filter((p) => (p.folder || "") === folder);
	return h("div", { className: "st_row", style: { alignItems: "center" } },
		h(Select, { value: folder, options: [{ id: "*", label: t("prompts.allPrompts") }, ...folders.map((f) => ({ id: f, label: "📁 " + f })), ...(prompts.some((p) => !p.folder) ? [{ id: "", label: t("prompts.unfiled") }] : [])], onChange: setFolder }),
		h(Button, { disabled: !chosen.length, onClick: () => submitPackToGallery(chosen, folder === "*" || !folder ? "" : folder) }, "🌍 " + t("prompts.packSubmit", { count: chosen.length })));
}

function PromptsTab() {
	const prompts = useSnap((s) => s.state.prompts);
	const [editing, setEditing] = useState(null);
	const [packBox, setPackBox] = useState(null);
	const folders = [...new Set(prompts.map((p) => p.folder).filter(Boolean))].sort();

	const save = () => {
		const entry = { id: editing.id ?? newId("p"), title: editing.title.trim() || t("prompts.untitled"), text: editing.text, folder: editing.folder.trim() };
		const exists = prompts.some((p) => p.id === entry.id);
		update({ prompts: exists ? prompts.map((p) => (p.id === entry.id ? entry : p)) : [...prompts, entry] });
		setEditing(null);
		toast(t(exists ? "prompts.updated" : "prompts.added"));
	};
	const move = (id, delta) => {
		const index = prompts.findIndex((p) => p.id === id);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= prompts.length) return;
		const next = [...prompts];
		[next[index], next[target]] = [next[target], next[index]];
		update({ prompts: next });
	};
	const importPack = (code) => {
		try {
			const added = addPrompts(decodePromptPack(code));
			setPackBox(null);
			toast(t("prompts.packImported", { count: added }));
		} catch (e) {
			toast(errorText(e));
		}
	};
	const importFile = async () => {
		const file = await pickFile("application/json,.json,.txt");
		if (!file) return;
		const text = (await file.text()).trim();
		if (text.startsWith("dshp1:")) return importPack(text);
		try {
			const parsed = JSON.parse(text);
			const added = addPrompts(Array.isArray(parsed) ? parsed : parsed.prompts ?? []);
			toast(t("prompts.packImported", { count: added }));
		} catch (e) {
			toast(errorText(e));
		}
	};

	return [
		h(Section, {
			key: "list",
			title: t("prompts.title"),
			description: t("prompts.description"),
			actions: h("div", { className: "st_actions" }, h(Button, { kind: "primary", onClick: () => setEditing({ id: null, title: "", text: "", folder: "" }) }, t("prompts.new"))),
		},
			editing
				? h("div", { className: "st_section", style: { background: "var(--dsw-alias-bg-layer-2)" } },
					h("div", { className: "st_row" },
						h(Field, { label: t("prompts.titleLabel") }, h("input", { className: "st_input", value: editing.title, maxLength: 80, autoFocus: true, onChange: (e) => setEditing({ ...editing, title: e.target.value }) })),
						h(Field, { label: t("prompts.folder"), hint: t("prompts.folderHint") },
							h("input", { className: "st_input", value: editing.folder, maxLength: 40, list: "st-prompt-folders", onChange: (e) => setEditing({ ...editing, folder: e.target.value }) }),
							h("datalist", { id: "st-prompt-folders" }, folders.map((f) => h("option", { key: f, value: f }))))),
					h(Field, { label: t("prompts.text"), hint: t("prompts.textHint") },
						h("textarea", { className: "st_input", rows: 6, value: editing.text, onChange: (e) => setEditing({ ...editing, text: e.target.value }) })),
					h("div", { className: "st_actions" },
						h(Button, { kind: "primary", onClick: save, disabled: !editing.text.trim() }, t("common.save")),
						h(Button, { onClick: () => setEditing(null) }, t("common.cancel"))))
				: null,
			prompts.length === 0
				? h("p", { className: "st_hint" }, t("prompts.empty"))
				: h("div", null, groupPrompts(prompts).map(([folder, items]) => h("div", { key: folder || "_" },
					folders.length ? h("div", { className: "st_folderHead" }, folder || t("prompts.unfiled")) : null,
					items.map((p) => h("div", { key: p.id, className: "st_promptRow" },
						h("div", { className: "st_promptBody" },
							h("div", { className: "st_promptTitle" }, p.title),
							h("div", { className: "st_promptText" }, p.text.replace(/\s+/g, " "))),
						h("div", { className: "st_actions" },
							h(Button, { small: true, onClick: () => move(p.id, -1), "aria-label": t("prompts.moveUp") }, "↑"),
							h(Button, { small: true, onClick: () => move(p.id, 1), "aria-label": t("prompts.moveDown") }, "↓"),
							h(Button, { small: true, onClick: () => void insertPrompt(p) }, t("prompts.insert")),
							h(Button, { small: true, onClick: () => setEditing({ ...p }) }, t("common.edit")),
							h(Button, { small: true, kind: "danger", onClick: () => update({ prompts: prompts.filter((x) => x.id !== p.id) }) }, t("common.delete"))))))))),
		h(Section, { key: "placeholders", title: t("prompts.placeholdersTitle"), description: t("prompts.placeholdersDescription") },
			h("pre", { className: "st_pre" }, ["{clipboard}  " + t("prompts.ph.clipboard"), "{date}  " + t("prompts.ph.date"), "{time}  " + t("prompts.ph.time"), "{day}  " + t("prompts.ph.day"), "{ask:" + t("prompts.ph.askExample") + "}  " + t("prompts.ph.ask")].join("\n"))),
		h(Section, { key: "packs", title: t("prompts.packsTitle"), description: t("prompts.packsDescription") },
			h("div", { className: "st_actions" },
				h(Button, { disabled: !prompts.length, onClick: () => { const code = encodePromptPack(prompts); copyText(code); setPackBox(code); toast(t("prompts.packCopied")); } }, t("prompts.packShare")),
				h(Button, { onClick: () => setPackBox(packBox == null ? "" : null) }, t("prompts.packPaste")),
				h(Button, { onClick: () => void importFile() }, t("prompts.packFile"))),
			packBox != null
				? h("div", { className: "st_row" },
					h(Field, { label: t("prompts.packCode") }, h("input", { className: "st_input st_mono", value: packBox, onChange: (e) => setPackBox(e.target.value) })),
					h(Button, { onClick: () => importPack(packBox) }, t("prompts.packAdd")))
				: null,
			prompts.length ? h("p", { className: "st_hint", style: { margin: "4px 0 0" } }, t("prompts.packGalleryHint")) : null,
			prompts.length ? h(PackSubmitter, { prompts, folders }) : null),
	];
}
//#endregion
