//#region spending alerts
const BUDGET_RANK = { off: 0, ok: 0, warn: 1, over: 2 };

/** Money in the display currency (amounts are stored in US dollars). */
function money(usd, usage = snapshot.state.usage) {
	const cur = CURRENCIES.find((c) => c.id === usage.currency) ?? CURRENCIES[0];
	const value = usd * (usage.currency === "USD" ? 1 : usage.rate);
	const digits = value !== 0 && Math.abs(value) < 1 ? 4 : 2;
	return cur.symbol + value.toLocaleString(snapshot.lang, { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

/**
 * Fetch spend against the budgets and alert once per level per day/month:
 * a heads-up past the warning point, and again when the limit is reached.
 */
async function checkBudget() {
	const budget = snapshot.state.usage.budget;
	if (!snapshot.loaded || (budget.daily == null && budget.monthly == null)) {
		if (snapshot.budget) setSnap({ budget: null });
		return;
	}
	let status;
	try {
		status = (await apiGet("usage")).budget;
	} catch {
		return;
	}
	if (!status) return;
	setSnap({ budget: status });
	for (const kind of ["daily", "monthly"]) {
		const s = status[kind];
		if (BUDGET_RANK[s.level] === 0) continue;
		const key = `dsh-studio:budget:${kind}:${s.period}`;
		let seen = 0;
		try { seen = BUDGET_RANK[localStorage.getItem(key)] ?? 0; } catch { /* storage blocked: alert every check instead */ }
		if (BUDGET_RANK[s.level] <= seen) continue;
		try { localStorage.setItem(key, s.level); } catch { /* storage blocked */ }
		const params = { period: t("budget." + kind), spent: money(s.spent), limit: money(s.limit), percent: Math.round(s.ratio * 100) };
		const title = t(s.level === "over" ? "budget.notifyOver" : "budget.notifyWarn", params);
		const body = t("budget.notifyBody", params);
		toast(`💸 ${title}`);
		playSound(snapshot.state.alerts.sound === "none" ? "chime" : snapshot.state.alerts.sound, snapshot.state.alerts.volume);
		notify(title, body, "budget-" + kind);
	}
}
//#endregion
