//#region Usage tab
function UsageChart({ days }) {
	const max = Math.max(1, ...days.map((d) => d.tokens));
	const W = 600;
	const H = 130;
	const col = W / days.length;
	const bar = Math.max(3, col * 0.62);
	return h("svg", { className: "st_chart", viewBox: `0 0 ${W} ${H + 16}`, preserveAspectRatio: "none", role: "img", "aria-label": t("usage.chartLabel") },
		days.map((d, i) => {
			const height = d.tokens ? Math.max(2, (d.tokens / max) * (H - 6)) : 0;
			return h("rect", { key: d.day, x: i * col + (col - bar) / 2, y: H - height, width: bar, height, rx: 2, fill: "var(--dsw-alias-state-business-primary)", opacity: d.tokens ? 0.9 : 0 },
				h("title", null, `${d.day} · ${fmtInt(d.tokens)} ${t("usage.tokens")} · ${fmtInt(d.calls)} ${t("usage.calls")}`));
		}),
		// A date every 7 days, counted back from today so the last label never collides.
		days.map((d, i) => ((days.length - 1 - i) % 7 === 0
			? h("text", { key: "l" + d.day, x: i * col + col / 2, y: H + 13, textAnchor: "middle", fontSize: 9, fill: "var(--dsw-alias-label-tertiary)" }, d.day.slice(5))
			: null)));
}

function PriceInput({ value, onCommit }) {
	const [text, setText] = useState(value == null ? "" : String(value));
	useEffect(() => setText(value == null ? "" : String(value)), [value]);
	const commit = () => {
		const s = text.trim();
		if (s === "") return onCommit(null);
		const n = Number(s);
		if (Number.isFinite(n) && n >= 0) onCommit(n);
		else setText(value == null ? "" : String(value));
	};
	return h("input", { className: "st_input st_priceInput st_num", value: text, inputMode: "decimal", placeholder: "—", onChange: (e) => setText(e.target.value), onBlur: commit, onKeyDown: (e) => { if (e.key === "Enter") commit(); } });
}

/** A limit entered in the display currency, stored in US dollars (empty = no limit). */
function BudgetInput({ usd, usage, onCommit }) {
	const rate = usage.currency === "USD" ? 1 : usage.rate;
	const shown = usd == null ? "" : String(Math.round(usd * rate * 100) / 100);
	const [text, setText] = useState(shown);
	useEffect(() => setText(shown), [shown]);
	const commit = () => {
		const v = text.trim();
		if (!v) return onCommit(null);
		const n = Number(v.replace(",", "."));
		if (Number.isFinite(n) && n > 0) onCommit(n / rate);
		else setText(shown);
	};
	const cur = CURRENCIES.find((c) => c.id === usage.currency) ?? CURRENCIES[0];
	return h("div", { className: "st_moneyInput" },
		h("span", { "aria-hidden": true }, cur.symbol),
		h("input", { className: "st_input st_num", value: text, inputMode: "decimal", placeholder: t("budget.noLimit"), onChange: (e) => setText(e.target.value), onBlur: commit, onKeyDown: (e) => { if (e.key === "Enter") commit(); } }));
}

function BudgetMeter({ label, s }) {
	if (!s || s.level === "off") return null;
	const pct = Math.min(100, Math.round(s.ratio * 100));
	return h("div", { className: "st_meterRow" },
		h("div", { className: "st_meterHead" }, h("span", null, label), h("span", { className: "st_hint" }, t("budget.meter", { spent: money(s.spent), limit: money(s.limit), percent: Math.round(s.ratio * 100) }))),
		h("div", { className: cls("st_meter", "st_meter_" + s.level), role: "meter", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct }, h("span", { style: { width: pct + "%" } })));
}

function BudgetSection({ usage, status }) {
	const b = usage.budget;
	const set = (patch) => update({ usage: { budget: patch } });
	return h(Section, { title: t("budget.title"), description: t("budget.description") },
		h("div", { className: "st_row" },
			h(Field, { label: t("budget.dailyLimit"), narrow: true }, h(BudgetInput, { usd: b.daily, usage, onCommit: (v) => set({ daily: v }) })),
			h(Field, { label: t("budget.monthlyLimit"), narrow: true }, h(BudgetInput, { usd: b.monthly, usage, onCommit: (v) => set({ monthly: v }) })),
			h(Slider, { label: t("budget.warnAt"), value: b.warnAt, min: 50, max: 100, step: 5, format: (v) => v + "%", onChange: (v) => set({ warnAt: v }) })),
		h(BudgetMeter, { label: t("budget.today"), s: status?.daily }),
		h(BudgetMeter, { label: t("budget.thisMonth"), s: status?.monthly }),
		status?.unpriced ? h("p", { className: "st_hint", style: { margin: 0 } }, t("budget.unpriced", { count: status.unpriced })) : null,
		h("span", { className: "st_hint" }, t("budget.hint")));
}

function UsageTab() {
	const usage = useSnap((s) => s.state.usage);
	const [data, setData] = useState(null);
	const [balance, setBalance] = useState(null);
	const [confirmClear, setConfirmClear] = useState(false);
	const refresh = async () => {
		try { setData(await apiGet("usage")); } catch (e) { setData({ error: errorText(e) }); }
	};
	useEffect(() => {
		void refresh();
		const timer = setInterval(refresh, 30_000);
		return () => clearInterval(timer);
	}, [usage.prices, usage.budget]);

	if (!data) return h(Section, { title: t("usage.title") }, h("p", { className: "st_hint" }, t("common.loading")));
	if (data.error) return h(Section, { title: t("usage.title") }, h("p", { className: "st_creditLine" }, data.error));
	const s = data.summary;
	const stat = (key, b) => h("div", { key, className: "st_stat" },
		h("span", { className: "st_statLabel" }, t("usage." + key)),
		h("span", { className: "st_statValue" }, fmtCompact(b.tokens)),
		h("span", { className: "st_statNote" }, `${fmtInt(b.calls)} ${t("usage.calls")} · ${b.cost || b.priced ? money(b.cost, usage) + (b.priced ? "" : "+") : t("usage.noPrices")}`));
	const setPrice = (model, field, value) => update({ usage: { prices: { [model]: { ...(usage.prices[model] ?? { input: null, output: null, cacheRead: null }), [field]: value } } } });
	const models = Object.entries(s.models).sort((a, b) => b[1].tokens - a[1].tokens);
	const clear = async () => {
		if (!confirmClear) return setConfirmClear(true);
		await apiPost("usage", { action: "clear" });
		setConfirmClear(false);
		void refresh();
		toast(t("usage.cleared"));
	};
	const checkBalance = async () => {
		setBalance({ loading: true });
		try { setBalance(await apiPost("usage", { action: "balance" })); } catch (e) { setBalance({ error: errorText(e) }); }
	};

	return [
		h(BudgetSection, { key: "budget", usage, status: data.budget }),
		h(Section, {
			key: "totals",
			title: t("usage.title"),
			description: data.since ? t("usage.since", { date: shortDate(new Date(data.since).toISOString()) }) : t("usage.empty"),
			actions: h(Button, { onClick: () => void refresh() }, t("common.refresh")),
		},
			h("div", { className: "st_stats" }, stat("today", s.today), stat("week", s.week), stat("month", s.month), stat("all", s.all)),
			h(UsageChart, { days: s.days })),
		h(Section, { key: "models", title: t("usage.modelsTitle"), description: t("usage.modelsDescription") },
			models.length
				? h("div", { className: "st_tableWrap" }, h("table", { className: "st_table" },
					h("thead", null, h("tr", null,
						h("th", null, t("usage.model")), h("th", { className: "st_num" }, t("usage.callsHeader")), h("th", { className: "st_num" }, t("usage.input")),
						h("th", { className: "st_num" }, t("usage.output")), h("th", { className: "st_num" }, t("usage.cached")), h("th", { className: "st_num" }, t("usage.cost")),
						h("th", null, t("usage.priceIn")), h("th", null, t("usage.priceOut")), h("th", null, t("usage.priceCached")))),
					h("tbody", null, models.map(([model, b]) => h("tr", { key: model },
						h("td", { className: "st_mono", title: model }, model),
						h("td", { className: "st_num" }, fmtInt(b.calls)), h("td", { className: "st_num" }, fmtCompact(b.input)),
						h("td", { className: "st_num" }, fmtCompact(b.output)), h("td", { className: "st_num" }, fmtCompact(b.cached)),
						h("td", { className: "st_num" }, b.priced ? money(b.cost, usage) : "—"),
						h("td", null, h(PriceInput, { value: usage.prices[model]?.input, onCommit: (v) => setPrice(model, "input", v) })),
						h("td", null, h(PriceInput, { value: usage.prices[model]?.output, onCommit: (v) => setPrice(model, "output", v) })),
						h("td", null, h(PriceInput, { value: usage.prices[model]?.cacheRead, onCommit: (v) => setPrice(model, "cacheRead", v) })))))))
				: h("p", { className: "st_hint" }, t("usage.noModels")),
			h("div", { className: "st_row" },
				h(Field, { label: t("usage.currency"), narrow: true }, h(Select, { value: usage.currency, options: CURRENCIES.map((c) => ({ id: c.id, label: `${c.symbol} ${c.id}` })), onChange: (v) => update({ usage: { currency: v } }) })),
				usage.currency !== "USD"
					? h(Field, { label: t("usage.rate", { currency: usage.currency }), narrow: true }, h(TextInput, { value: String(usage.rate), onCommit: (v) => { const n = Number(v); if (Number.isFinite(n) && n > 0) update({ usage: { rate: n } }); } }))
					: null)),
		h(Section, { key: "balance", title: t("usage.balanceTitle"), description: t("usage.balanceDescription", { env: usage.balanceEnv }), actions: h(Button, { disabled: balance?.loading, onClick: () => void checkBalance() }, t("usage.checkBalance")) },
			balance && !balance.loading
				? balance.error
					? h("p", { className: "st_creditLine" }, hostText(balance.error))
					: h("p", { className: "st_creditLine" }, balance.balances.map((b) => `${b.currency} ${b.total.toFixed(2)}`).join(" · ") + (balance.available ? "" : " · " + t("usage.unavailable")))
				: null),
		h(Section, {
			key: "recent",
			title: t("usage.recentTitle"),
			actions: h(Button, { kind: "danger", onClick: () => void clear() }, confirmClear ? t("usage.clearConfirm") : t("usage.clear")),
		},
			data.recent.length
				? h("div", { className: "st_tableWrap" }, h("table", { className: "st_table" },
					h("thead", null, h("tr", null, h("th", null, t("usage.time")), h("th", null, t("usage.model")), h("th", { className: "st_num" }, t("usage.input")), h("th", { className: "st_num" }, t("usage.output")), h("th", { className: "st_num" }, t("usage.cached")), h("th", { className: "st_num" }, t("usage.seconds")))),
					h("tbody", null, data.recent.map((r, i) => h("tr", { key: r.t + "-" + i },
						h("td", null, new Date(r.t).toLocaleTimeString(snapshot.lang, { hour: "2-digit", minute: "2-digit" })),
						h("td", { className: "st_mono" }, r.m + (r.ok ? "" : " ⚠")),
						h("td", { className: "st_num" }, fmtInt(r.a + r.w)), h("td", { className: "st_num" }, fmtInt(r.o)), h("td", { className: "st_num" }, fmtInt(r.r)),
						h("td", { className: "st_num" }, (r.d / 1000).toFixed(1)))))))
				: h("p", { className: "st_hint" }, t("usage.noCalls"))),
	];
}
//#endregion
