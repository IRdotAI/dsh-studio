//#region alerts: sounds, notifications, session watcher
let audioCtx = null;

/** Small synthesized sounds (Web Audio), so nothing needs shipping or downloading. */
function playSound(kind, volume) {
	if (kind === "none" || volume <= 0 || typeof window === "undefined") return;
	try {
		audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
		if (audioCtx.state === "suspended") void audioCtx.resume();
		const ac = audioCtx;
		const peak = (volume / 100) * 0.35;
		const start = ac.currentTime + 0.02;
		const tone = (freq, at, dur, type = "sine", level = peak, endFreq) => {
			const osc = ac.createOscillator();
			const gain = ac.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(freq, start + at);
			if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + at + dur);
			gain.gain.setValueAtTime(0.0001, start + at);
			gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), start + at + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + at + dur);
			osc.connect(gain).connect(ac.destination);
			osc.start(start + at);
			osc.stop(start + at + dur + 0.05);
		};
		if (kind === "chime") {
			tone(880, 0, 0.55);
			tone(1318.5, 0.13, 0.8);
		} else if (kind === "glass") {
			tone(2093, 0, 0.9, "triangle", peak * 0.6);
			tone(2637, 0.04, 1.1, "sine", peak * 0.4);
			tone(3136, 0.09, 0.8, "sine", peak * 0.25);
		} else if (kind === "pop") {
			tone(540, 0, 0.11, "sine", peak, 240);
		}
	} catch { /* audio unavailable */ }
}

function notify(title, body, tag) {
	if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
	try {
		const n = new Notification(title, { body, tag: "dsh-studio-" + tag, icon: "/favicon.svg" });
		n.onclick = () => {
			window.focus();
			n.close();
		};
	} catch { /* notifications unavailable */ }
}

function alert_(kind, sessionId, seconds) {
	const a = snapshot.state.alerts;
	if (!a.enabled) return;
	if (kind === "done" && seconds < a.minSeconds) return;
	const away = document.hidden || !document.hasFocus();
	if (a.onlyWhenAway && !away) return;
	playSound(a.sound, a.volume);
	if (a.notify) {
		notify(
			t(kind === "done" ? "alerts.notifyDone" : "alerts.notifyInput"),
			kind === "done" ? t("alerts.notifyDoneBody", { seconds: Math.round(seconds) }) : t("alerts.notifyInputBody"),
			sessionId,
		);
	}
}

/**
 * Watch every Session's UI status: running → stopped is a finished task;
 * a new pending interaction (approval, question) means the agent needs you.
 */
function watchSessions(uiSession) {
	const source = uiSession?.sessionStatus;
	if (!source?.subscribe || !source.getSnapshot) return () => {};
	const started = new Map();
	const copy = (snap) => new Map([...(snap ?? new Map())].map(([id, s]) => [id, { running: s.running, pending: Boolean(s.pendingInteraction) }]));
	let prev = copy(source.getSnapshot());
	for (const [id, s] of prev) if (s.running) started.set(id, Date.now());
	return source.subscribe(() => {
		const next = copy(source.getSnapshot());
		for (const [id, s] of next) {
			const before = prev.get(id);
			if (s.running && !before?.running) started.set(id, Date.now());
			if (before?.running && s.running === false) {
				const seconds = (Date.now() - (started.get(id) ?? Date.now())) / 1000;
				started.delete(id);
				if (!s.pending) alert_("done", id, seconds);
			}
			if (s.pending && !before?.pending && snapshot.state.alerts.needsInput) alert_("input", id, 0);
		}
		prev = next;
	});
}
//#endregion

//#region Alerts tab
function AlertsTab() {
	const a = useSnap((s) => s.state.alerts);
	const [permission, setPermission] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
	const set = (patch) => update({ alerts: patch });
	const ask = async () => {
		try {
			setPermission(await Notification.requestPermission());
		} catch {
			setPermission("denied");
		}
	};
	const test = () => {
		playSound(a.sound, a.volume);
		if (a.notify) notify(t("alerts.notifyDone"), t("alerts.testBody"), "test");
	};
	return [
		h(Section, { key: "main", title: t("alerts.title"), description: t("alerts.description") },
			h(Toggle, { checked: a.enabled, onChange: (v) => { set({ enabled: v }); if (v && permission === "default" && a.notify) void ask(); }, label: t("alerts.enable") }),
			h(Toggle, { checked: a.onlyWhenAway, onChange: (v) => set({ onlyWhenAway: v }), label: t("alerts.onlyAway"), hint: t("alerts.onlyAwayHint") }),
			h(Toggle, { checked: a.needsInput, onChange: (v) => set({ needsInput: v }), label: t("alerts.needsInput"), hint: t("alerts.needsInputHint") }),
			h(Slider, { label: t("alerts.minSeconds"), value: a.minSeconds, min: 0, max: 300, step: 5, format: (v) => (v ? t("alerts.seconds", { n: v }) : t("alerts.always")), onChange: (v) => set({ minSeconds: v }) })),
		h(Section, { key: "how", title: t("alerts.howTitle") },
			h(Toggle, { checked: a.notify, onChange: (v) => { set({ notify: v }); if (v && permission === "default") void ask(); }, label: t("alerts.notify"), hint: t("alerts.permission." + permission) }),
			permission === "default" || permission === "denied" ? h("div", { className: "st_actions" }, h(Button, { onClick: () => void ask() }, t("alerts.allow"))) : null,
			h("div", { className: "st_row" },
				h(Field, { label: t("alerts.sound"), narrow: true, group: true },
					h(Segmented, { label: t("alerts.sound"), value: a.sound, options: SOUNDS.map((s) => ({ id: s.id, label: t("sound." + s.id) })), onChange: (v) => { set({ sound: v }); playSound(v, a.volume); } })),
				h(Slider, { label: t("alerts.volume"), value: a.volume, min: 0, max: 100, step: 5, format: (v) => v + "%", onChange: (v) => set({ volume: v }) })),
			h("div", { className: "st_actions" }, h(Button, { onClick: test }, t("alerts.test")))),
	];
}
//#endregion
