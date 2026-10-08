//#region small helpers + atoms
const cls = (...names) => names.filter(Boolean).join(" ");
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function mix(a, b, amount) {
	const A = parseHex(a);
	const B = parseHex(b);
	if (!A || !B) return a;
	return "#" + A.map((v, i) => Math.round((v + (B[i] - v) * amount) * 255).toString(16).padStart(2, "0")).join("");
}

function PaletteIcon({ size = 16, className }) {
	return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", className, "aria-hidden": true },
		h("path", { d: "M8 1.75a6.25 6.25 0 1 0 0 12.5c.9 0 1.4-.6 1.4-1.3 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.6-1.3 1.4-1.3h1.6c1.6 0 2.65-1.2 2.65-2.8C14.25 4.2 11.5 1.75 8 1.75Z", stroke: "currentColor", strokeWidth: 1.3, strokeLinejoin: "round" }),
		h("circle", { cx: 4.8, cy: 7.3, r: 1, fill: "currentColor" }),
		h("circle", { cx: 6.8, cy: 4.6, r: 1, fill: "currentColor" }),
		h("circle", { cx: 10.1, cy: 4.7, r: 1, fill: "currentColor" }),
	);
}

function SparkIcon({ size = 16, className }) {
	return h("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", className, "aria-hidden": true },
		h("path", { d: "M7 1.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5 2.9-.3 4.2-1.6 4.5-4.5Z", fill: "currentColor" }),
		h("path", { d: "M12.5 9.5c.15 1.4.8 2.05 2.2 2.2-1.4.15-2.05.8-2.2 2.2-.15-1.4-.8-2.05-2.2-2.2 1.4-.15 2.05-.8 2.2-2.2Z", fill: "currentColor", opacity: 0.7 }),
	);
}

/** The harness's own whale mark (from its favicon), drawn in the current text colour. */
function DeepSeekLogo({ size = 24 }) {
	return h("svg", { width: size, height: size, viewBox: "0 0 50 50", fill: "currentColor", "aria-label": "DeepSeek", role: "img" },
		h("path", { d: "M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z" }));
}

function Section({ title, description, children, actions }) {
	return h("section", { className: "st_section" },
		h("div", { className: "st_row", style: { justifyContent: "space-between", alignItems: "flex-start" } },
			h("div", { className: "st_sectionHead" }, h("h3", null, title), description ? h("p", null, description) : null),
			actions ?? null,
		),
		react.Children.toArray(children),
	);
}

/** A labelled control. `group` renders a <div> for button groups, which must not sit inside a <label>. */
function Field({ label, hint, children, narrow, group }) {
	return h(group ? "div" : "label", { className: cls("st_field", narrow && "st_field_narrow"), role: group ? "group" : undefined },
		label ? h("span", { className: "st_label" }, label) : null,
		react.Children.toArray(children),
		hint ? h("span", { className: "st_hint" }, hint) : null,
	);
}

function Button({ kind, small, children, ...rest }) {
	return h("button", { type: "button", className: cls("st_btn", kind && "st_btn_" + kind, small && "st_btn_small"), ...rest }, children);
}

function Segmented({ value, options, onChange, label }) {
	return h("div", { className: "st_seg", role: "group", "aria-label": label },
		options.map((o) => h("button", { key: o.id, type: "button", className: "st_segBtn", "aria-pressed": o.id === value, onClick: () => onChange(o.id) }, o.label)));
}

function Toggle({ checked, onChange, label, hint, disabled }) {
	return h("label", { className: "st_toggle", style: disabled ? { opacity: 0.55, cursor: "default" } : undefined },
		h("input", { type: "checkbox", checked, disabled, onChange: (e) => onChange(e.target.checked), style: { position: "absolute", opacity: 0, width: 1, height: 1 } }),
		h("span", { className: "st_switch", "data-on": String(Boolean(checked)), "aria-hidden": true }),
		h("span", { className: "st_toggleText" }, h("span", null, label), hint ? h("span", { className: "st_hint" }, hint) : null),
	);
}

function Slider({ label, value, min, max, step = 1, onChange, format }) {
	return h("label", { className: "st_field" },
		h("span", { className: "st_rangeHead" }, h("span", null, label), h("span", null, format ? format(value) : value)),
		h("input", {
			type: "range", className: "st_range", min, max, step, value,
			"aria-label": typeof label === "string" ? label : undefined, "aria-valuetext": format ? String(format(value)) : undefined,
			onChange: (e) => onChange(Number(e.target.value)),
		}),
	);
}

function Select({ value, options, onChange, className }) {
	return h("select", { className: cls("st_input", className), value, onChange: (e) => onChange(e.target.value) },
		options.map((o) => h("option", { key: o.id, value: o.id }, o.label)));
}

/** Local edits that commit after a pause — for values that are costly to apply per keystroke. */
function useDebounced(value, commit, ms = 400) {
	const [draft, setDraft] = useState(value);
	const timer = useRef(null);
	const latest = useRef(value);
	useEffect(() => {
		if (value !== latest.current) {
			latest.current = value;
			setDraft(value);
		}
	}, [value]);
	useEffect(() => () => clearTimeout(timer.current), []);
	const onChange = (next) => {
		setDraft(next);
		latest.current = next;
		clearTimeout(timer.current);
		timer.current = setTimeout(() => commit(next), ms);
	};
	return [draft, onChange];
}

function TextInput({ value, onCommit, placeholder, mono, maxLength, type }) {
	const [draft, setDraft] = useDebounced(value, onCommit, 350);
	return h("input", { className: cls("st_input", mono && "st_mono"), type, value: draft, placeholder, maxLength, onChange: (e) => setDraft(e.target.value) });
}

function TextArea({ value, onCommit, placeholder, rows = 4, mono }) {
	const [draft, setDraft] = useDebounced(value, onCommit, 500);
	return h("textarea", { className: cls("st_input", mono && "st_mono"), value: draft, placeholder, rows, spellCheck: !mono, onChange: (e) => setDraft(e.target.value) });
}

function Swatch({ color }) {
	return h("span", { className: "st_swatch", style: { background: color }, "aria-hidden": true });
}

function ExternalLink({ href, children }) {
	return h("a", { className: "st_link", href, target: "_blank", rel: "noopener noreferrer" }, children);
}

const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString(snapshot.lang, { day: "numeric", month: "short", year: "numeric" }) : "");

function sinceText(ts) {
	if (!ts) return t("time.never");
	const mins = Math.round((Date.now() - ts) / 60000);
	if (mins < 1) return t("time.justNow");
	if (mins < 60) return t("time.minutesAgo", { n: mins });
	const hours = Math.round(mins / 60);
	return hours < 48 ? t("time.hoursAgo", { n: hours }) : t("time.daysAgo", { n: Math.round(hours / 24) });
}

const fmtInt = (n) => Math.round(n ?? 0).toLocaleString(snapshot.lang);
function fmtCompact(n) {
	try {
		return new Intl.NumberFormat(snapshot.lang, { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
	} catch {
		return fmtInt(n);
	}
}
//#endregion

//#region theme previews & marks
function Mock({ m }) {
	const side = mix(m.bg, m.fg, 0.06);
	const muted = mix(m.bg, m.fg, 0.42);
	return h("div", { className: "st_mock", style: { background: m.bg } },
		h("div", { className: "st_mockSide", style: { background: side } },
			h("i", { style: { background: mix(m.bg, m.fg, 0.3) } }),
			h("i", { style: { background: mix(m.bg, m.fg, 0.2) } }),
			h("i", { style: { background: mix(side, m.accent, 0.6) } }),
		),
		h("div", { className: "st_mockMain" },
			h("i", { className: "st_mockBubble", style: { background: mix(m.bg, m.accent, 0.2) } }),
			h("i", { className: "st_mockLine", style: { background: m.fg, width: "80%" } }),
			h("i", { className: "st_mockLine", style: { background: muted, width: "58%" } }),
			h("i", { className: "st_mockLine", style: { background: muted, width: "68%" } }),
			h("i", { className: "st_mockPill", style: { background: m.accent } }),
		),
	);
}

function ThemeCard({ choice, active, onPick, footer }) {
	return h("div", { className: "st_galleryCard" },
		h("button", { type: "button", className: cls("st_card", active && "st_card_active"), onClick: onPick, "aria-pressed": active, title: choice.description },
			h("div", { className: "st_cardMocks" }, h(Mock, { m: choice.theme.dark }), h(Mock, { m: choice.theme.light })),
			h("div", { className: "st_cardFoot" },
				h("span", { "aria-hidden": true }, choice.emoji),
				h("span", { className: "st_cardName" }, choice.name),
				active ? h("span", { className: "st_cardCheck" }, t("themes.active")) : null,
			),
			footer ?? null,
		),
	);
}

/** A contrast ratio, green when it meets `min`; with `onFix`, a failing badge becomes a one-click fix. */
function ContrastBadge({ fg, bg, min, label, onFix }) {
	const ratio = contrast(fg, bg);
	const title = t("editor.contrastTitle", { label, ratio: ratio.toFixed(2), min });
	if (ratio < min && onFix) {
		return h("button", { type: "button", className: "st_badge st_badge_warn st_badgeBtn", title: title + " " + t("editor.fixTitle"), onClick: onFix },
			`${ratio.toFixed(1)}:1 · ${t("editor.fix")}`);
	}
	return h("span", { className: cls("st_badge", ratio >= min ? "st_badge_ok" : "st_badge_warn"), title }, `${ratio.toFixed(1)}:1`);
}

function initialsOf(name) {
	return String(name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function MarkPreview({ identity, size }) {
	if (identity.mark === "emoji") {
		return h("span", { className: "st_markEmoji", style: { width: size, height: size, fontSize: Math.round(size * 0.82) } }, identity.markEmoji || "✨");
	}
	if (identity.mark === "monogram") {
		const text = (identity.markText || initialsOf(identity.name || identity.appName) || "✦").slice(0, 3);
		return h("span", { className: "st_markMono", style: { width: size, height: size, fontSize: Math.round(size * (text.length > 1 ? 0.42 : 0.56)) } }, text);
	}
	if (identity.mark === "image" && identity.markImage) {
		return h("img", { className: "st_markImg", src: identity.markImage, width: size, height: size, alt: "" });
	}
	return h(DeepSeekLogo, { size });
}
//#endregion
