//#region composer button
function PromptsButton({ sessionId, inputActions, useInput }) {
	useT();
	const draft = typeof useInput === "function" ? useInput((s) => (s && typeof s.draft === "string" ? s.draft : "")) : "";
	const draftRef = useRef(draft);
	draftRef.current = draft;
	const prompts = useSnap((s) => s.state.prompts);
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);

	useEffect(() => {
		if (!sessionId || !inputActions) return;
		const entry = { actions: inputActions, getDraft: () => draftRef.current };
		composers.set(sessionId, entry);
		lastComposer = sessionId;
		return () => {
			if (composers.get(sessionId) === entry) composers.delete(sessionId);
			if (lastComposer === sessionId) lastComposer = [...composers.keys()].pop() ?? null;
		};
	}, [sessionId, inputActions]);

	useEffect(() => {
		if (!open) return;
		const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
		const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
		document.addEventListener("mousedown", onDown, true);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("mousedown", onDown, true);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	if (!inputActions) return null;
	const item = (p) => h("button", {
		key: p.id, type: "button", role: "menuitem", className: "st_cbItem",
		onClick: () => { setOpen(false); void insertPrompt(p, sessionId); },
	}, h("span", { className: "st_cbItemTitle" }, p.title), h("span", { className: "st_cbItemText" }, p.text.replace(/\s+/g, " ")));
	return h("div", { className: "st_cbWrap", ref: rootRef, dir: langDir(snapshot.lang) },
		h("button", {
			type: "button", className: "st_cbBtn", title: t("composer.title"), "aria-label": t("composer.title"), "aria-expanded": open,
			onClick: () => { lastComposer = sessionId; setOpen((o) => !o); },
		}, h(SparkIcon, { size: 16 })),
		open
			? h("div", { className: "st_cbMenu", role: "menu" },
				h("div", { className: "st_cbHead" }, t("composer.title")),
				prompts.length === 0 ? h("div", { className: "st_hint", style: { padding: "6px 10px" } }, t("composer.none")) : null,
				groupPrompts(prompts).map(([folder, list]) => [
					folder ? h("div", { key: "f:" + folder, className: "st_cbFolder" }, "📁 " + folder) : null,
					...list.map(item),
				]),
				h("button", { type: "button", className: "st_cbManage", onClick: () => { setOpen(false); openStudio("prompts"); } }, t("composer.manage")))
			: null,
	);
}
//#endregion
