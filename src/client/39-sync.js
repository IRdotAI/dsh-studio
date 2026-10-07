//#region Sync tab
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=DeepSeek%20Harness%20Studio%20sync";

function SyncTab() {
	const settings = useSnap((s) => s.state.sync);
	const [status, setStatus] = useState(null);
	const [token, setToken] = useState("");
	const [busy, setBusy] = useState(null);
	const [confirmRestore, setConfirmRestore] = useState(false);
	const refresh = async () => {
		try { setStatus((await apiGet("sync")).sync); } catch (e) { setStatus({ error: errorText(e) }); }
	};
	useEffect(() => { void refresh(); }, []);

	const act = async (action, extra, doneKey) => {
		setBusy(action);
		try {
			const res = await apiPost("sync", { action, ...extra });
			setStatus(res.sync);
			if (res.state) adoptState(res);
			if (doneKey) toast(t(doneKey));
			return true;
		} catch (e) {
			if (e.data?.sync) setStatus(e.data.sync);
			toast(errorText(e));
			return false;
		} finally {
			setBusy(null);
		}
	};

	if (!status) return h(Section, { title: t("sync.title") }, h("p", { className: "st_hint" }, t("common.loading")));
	return [
		h(Section, { key: "account", title: t("sync.title"), description: t("sync.description") },
			status.hasToken
				? h("div", { className: "st_row", style: { alignItems: "center" } },
					h("span", { className: "st_creditLine", style: { flex: 1 } }, status.login ? t("sync.connectedAs", { login: status.login }) : t("sync.connected", { source: t("sync.source." + status.tokenSource) })),
					status.tokenSource === "saved" ? h(Button, { kind: "danger", disabled: Boolean(busy), onClick: () => void act("clear-token", {}, "sync.tokenRemoved") }, t("sync.removeToken")) : null)
				: [
					h("p", { key: "how", className: "st_creditLine" }, t("sync.howTo")),
					h("div", { key: "row", className: "st_row" },
						h(Field, { label: t("sync.token"), hint: t("sync.tokenHint") },
							h("input", { className: "st_input st_mono", type: "password", value: token, autoComplete: "off", spellCheck: false, placeholder: "ghp_…", onChange: (e) => setToken(e.target.value) })),
						h(Button, { kind: "primary", disabled: !token.trim() || Boolean(busy), onClick: async () => { if (await act("set-token", { token }, "sync.tokenSaved")) setToken(""); } }, busy === "set-token" ? t("common.checking") : t("sync.connect"))),
					h("div", { key: "link", className: "st_actions" }, h("a", { className: "st_btn", href: TOKEN_URL, target: "_blank", rel: "noopener noreferrer" }, t("sync.createToken"))),
				]),
		h(Section, { key: "backup", title: t("sync.backupTitle"), description: status.gistUrl ? undefined : t("sync.noBackupYet") },
			status.gistUrl ? h("p", { className: "st_creditLine" }, t("sync.backupAt"), " ", h(ExternalLink, { href: status.gistUrl }, status.gistUrl.replace("https://", "")), ". ", t("sync.lastBackup", { when: sinceText(status.lastPush) })) : null,
			status.error ? h("p", { className: "st_creditLine" }, hostText(status.error)) : null,
			h("div", { className: "st_actions" },
				h(Button, { kind: "primary", disabled: !status.hasToken || Boolean(busy), onClick: () => void act("push", {}, "sync.backedUp") }, busy === "push" ? t("sync.backingUp") : t("sync.backupNow")),
				confirmRestore
					? [
						h(Button, { key: "yes", kind: "danger", disabled: Boolean(busy), onClick: async () => { setConfirmRestore(false); await act("pull", {}, "sync.restored"); } }, t("sync.restoreConfirm")),
						h(Button, { key: "no", onClick: () => setConfirmRestore(false) }, t("common.cancel")),
					]
					: h(Button, { disabled: !status.hasToken || Boolean(busy), onClick: () => setConfirmRestore(true) }, busy === "pull" ? t("sync.restoring") : t("sync.restore"))),
			h(Toggle, { checked: settings.auto, disabled: !status.hasToken, onChange: (v) => update({ sync: { auto: v } }), label: t("sync.auto"), hint: t("sync.autoHint") }),
			h(Toggle, { checked: settings.includeImages, onChange: (v) => update({ sync: { includeImages: v } }), label: t("sync.images"), hint: t("sync.imagesHint") })),
	];
}
//#endregion
