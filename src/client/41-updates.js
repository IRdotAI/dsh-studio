//#region updates UI
/** Why the one-click buttons are unavailable, in words. */
function blockerText(u) {
	const add = `Plugins → Add plugin → github:${u.repo ?? "IRdotAI/dsh-studio"}`;
	return u.blocker ? t("updates.blocker." + u.blocker, { add }) : null;
}

/** Shown at the top of every Studio tab while there's something to say about updates. */
function UpdateBanner() {
	useT();
	const u = useSnap((s) => s.updates);
	const auto = useSnap((s) => s.state.updates.auto);
	if (!u) return null;
	let body = null;
	if (u.restarting) {
		body = [h("span", { key: "i", className: "st_updateIcon st_spin", "aria-hidden": true }, "⟳"), h("div", { key: "t", className: "st_lookText" }, h("div", { className: "st_lookTitle" }, t("updates.restartingTitle")), h("div", { className: "st_lookDesc" }, t("updates.restartingDesc", { version: u.restarting })))];
	} else if (u.status === "installing" && u.installing) {
		body = [h("span", { key: "i", className: "st_updateIcon st_spin", "aria-hidden": true }, "⟳"), h("div", { key: "t", className: "st_lookText" }, h("div", { className: "st_lookTitle" }, t("updates.installingTitle", { version: u.installing.version })), h("div", { className: "st_lookDesc" }, t("updates.installingDesc")))];
	} else if (u.restartTo) {
		const desc = u.waitingForIdle ? t("updates.installedWaitDesc") : t("updates.installedDesc");
		body = [
			h("span", { key: "i", className: "st_updateIcon", "aria-hidden": true }, "✅"),
			h("div", { key: "t", className: "st_lookText" }, h("div", { className: "st_lookTitle" }, t("updates.installedTitle", { version: u.restartTo })), h("div", { className: "st_lookDesc" }, desc)),
			u.canRestart ? h("div", { key: "a", className: "st_actions" }, h(Button, { kind: "primary", onClick: () => void restartForUpdate() }, t("updates.restartNow"))) : null,
		];
	} else if (u.updateAvailable && !u.blocker) {
		body = [
			h("span", { key: "i", className: "st_updateIcon", "aria-hidden": true }, "✨"),
			h("div", { key: "t", className: "st_lookText" }, h("div", { className: "st_lookTitle" }, t("updates.availableTitle", { version: u.latest })), h("div", { className: "st_lookDesc" }, t("updates.youHave", { version: u.current }))),
			h("div", { key: "a", className: "st_actions" },
				h(Button, { kind: "primary", onClick: () => void installVersion(u.latest) }, t("updates.updateNow")),
				auto ? null : h(Button, { onClick: () => setAutoUpdates(true) }, t("updates.turnOnAuto")),
				h(Button, { onClick: () => setSnap({ tab: "updates" }) }, t("updates.whatsNew"))),
		];
	}
	return body ? h("div", { className: "st_look", role: "status" }, body) : null;
}

function ReleaseRow({ release, u }) {
	const [open, setOpen] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const order = compareVersions(release.version, u.current);
	const busy = u.status === "installing";
	const label = order > 0 ? t("updates.update") : order === 0 ? t("updates.reinstall") : t("updates.downgrade");
	const preUpdater = compareVersions(release.version, UPDATER_SINCE) < 0;
	return h("div", { className: "st_relRow" },
		h("div", { className: "st_relHead" },
			h("span", { className: "st_relVersion" }, "v" + release.version),
			release.version === u.latest ? h("span", { className: "st_badge st_badge_ok" }, t("updates.latest")) : null,
			order === 0 ? h("span", { className: "st_badge st_badge_accent" }, t("updates.installed")) : null,
			release.prerelease ? h("span", { className: "st_badge st_badge_warn" }, t("updates.prerelease")) : null,
			h("span", { className: "st_hint", style: { flex: 1 } }, shortDate(release.publishedAt)),
			release.notes ? h(Button, { small: true, onClick: () => setOpen(!open) }, open ? t("updates.hideNotes") : t("updates.whatsNew")) : null,
			u.blocker ? null : h(Button, { small: true, kind: order > 0 ? "primary" : undefined, disabled: busy, onClick: () => (order < 0 ? setConfirming(true) : void installVersion(release.version)) }, label)),
		confirming
			? h("div", { className: "st_relConfirm" },
				h("p", { className: "st_creditLine" }, t("updates.downgradeWarning", { version: release.version })),
				preUpdater ? h("p", { className: "st_creditLine" }, t("updates.preUpdaterWarning", { version: release.version, add: `Plugins → Add plugin → github:${u.repo}` })) : null,
				h("div", { className: "st_actions" },
					h(Button, { kind: "danger", disabled: busy, onClick: () => { setConfirming(false); void installVersion(release.version); } }, t("updates.downgradeConfirm", { version: release.version })),
					h(Button, { onClick: () => setConfirming(false) }, t("common.cancel"))))
			: null,
		open ? h("pre", { className: "st_pre" }, release.notes) : null,
	);
}

function UpdatesTab() {
	const u = useSnap((s) => s.updates);
	const auto = useSnap((s) => s.state.updates.auto);
	const restartAfter = useSnap((s) => s.state.updates.restartAfter);
	if (!u) return h(Section, { title: t("updates.title") }, h("p", { className: "st_hint" }, t("updates.unreachable")));
	const blocked = blockerText(u);
	return [
		h(Section, {
			key: "status",
			title: `Studio v${u.current}`,
			description: u.repo ? t("updates.source", { repo: u.repo }) : undefined,
			actions: h(Button, { disabled: u.status !== "idle", onClick: () => void checkForUpdates() }, u.status === "checking" ? t("common.checking") : t("updates.check")),
		},
			blocked ? h("p", { className: "st_creditLine" }, blocked) : null,
			h(Toggle, { checked: auto && !u.blocker, disabled: Boolean(u.blocker), onChange: setAutoUpdates, label: t("updates.auto"), hint: u.blocker ? t("updates.autoUnavailable") : t("updates.autoHint") }),
			h(Toggle, {
				checked: restartAfter && u.canRestart, disabled: !u.canRestart, label: t("updates.restartAfter"),
				hint: u.canRestart ? t("updates.restartAfterHint") : t("updates.restartUnavailable"),
				onChange: (on) => { update({ updates: { restartAfter: on } }); setTimeout(loadUpdates, 800); },
			}),
			h("span", { className: "st_hint" },
				u.error ? hostText(u.error) : u.updateAvailable ? t("updates.available", { version: u.latest }) : u.releases.length ? t("updates.upToDate") : t("updates.noReleases"),
				" ", t("updates.lastChecked", { when: sinceText(u.lastCheck) })),
		),
		h(Section, { key: "versions", title: t("updates.allVersions"), description: t("updates.allVersionsDescription") },
			u.releases.length ? h("div", null, u.releases.map((r) => h(ReleaseRow, { key: r.tag, release: r, u }))) : h("p", { className: "st_hint" }, t("updates.nothingYet"))),
	];
}

/** The sidebar entry's icon, with a dot while an update is waiting. */
function StudioNavIcon(props) {
	const u = useSnap((s) => s.updates);
	const dot = Boolean(u && ((u.updateAvailable && !u.blocker) || u.restartTo));
	return h("span", { className: "st_navIcon" }, h(PaletteIcon, props), dot ? h("span", { className: "st_navDot", "aria-label": t("updates.dotLabel") }) : null);
}
//#endregion
