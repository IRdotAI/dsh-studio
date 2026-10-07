//#region Advanced tab
function AdvancedTab() {
	const state = useSnap((s) => s.state);
	const [confirmReset, setConfirmReset] = useState(false);
	const exportJson = () => {
		const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "dsh-studio-settings.json";
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	};
	const importJson = async () => {
		const file = await pickFile("application/json,.json");
		if (!file) return;
		try {
			await replaceState(sanitizeState(JSON.parse(await file.text())));
			toast(t("advanced.imported"));
		} catch (e) {
			toast(t("advanced.importFailed", { error: errorText(e) }));
		}
	};
	const reset = async () => {
		if (!confirmReset) {
			setConfirmReset(true);
			return;
		}
		try {
			await resetState();
			setConfirmReset(false);
			toast(t("advanced.resetDone"));
		} catch (e) {
			toast(errorText(e));
		}
	};
	return [
		h(Section, { key: "css", title: t("advanced.cssTitle"), description: t("advanced.cssDescription") },
			h(TextArea, { value: state.customCss, rows: 10, mono: true, placeholder: "/* e.g. */\n[class*=\"_composer\"] { box-shadow: 0 0 0 1px var(--dsw-alias-state-business-primary); }", onCommit: (v) => update({ customCss: v }) })),
		h(Section, { key: "io", title: t("advanced.backupTitle"), description: t("advanced.backupDescription") },
			h("div", { className: "st_actions" },
				h(Button, { onClick: exportJson }, t("advanced.export")),
				h(Button, { onClick: importJson }, t("advanced.import")),
				h(Button, { kind: "danger", onClick: () => void reset() }, confirmReset ? t("advanced.resetConfirm") : t("advanced.reset")))),
	];
}
//#endregion
