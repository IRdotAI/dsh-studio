//#region chat export
/** The chat in the main view (or the last composer used). */
function currentSessionId() {
	try {
		const id = services.uiWorkspace?.selection?.getSnapshot?.()?.sessionId;
		if (id) return id;
	} catch { /* no workspace service */ }
	return lastComposer ?? null;
}

function sessionTitle(id) {
	try {
		const row = services.sessions?.list?.getSnapshot?.()?.byId?.[id];
		return String(row?.title ?? "").trim();
	} catch {
		return "";
	}
}

const fileSlug = (s) => (s || "chat").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "chat";

function downloadText(name, text, type) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([text], { type }));
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Print-ready HTML for a transcript, in the theme's colours or plain black on white. */
function transcriptHtml(title, messages, themed) {
	const mode = document.body?.hasAttribute("data-ds-dark-theme") ? "dark" : "light";
	const theme = resolveTheme(effectiveState()) ?? STOCK_THEME;
	const c = themed ? theme[mode] : { bg: "#ffffff", fg: "#111111", accent: "#2f63d8" };
	const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	const body = messages.map((m) => {
		const who = m.role === "user" ? t("export.you") : t("export.assistant");
		const tools = m.tools?.length ? `<p class="tools">${esc(t("export.tools"))}: ${[...new Set(m.tools)].map((n) => `<code>${esc(n)}</code>`).join(", ")}</p>` : "";
		return `<section class="msg ${m.role}"><div class="who">${esc(who)}</div>${markdownToHtml(m.text)}${tools}</section>`;
	}).join("\n");
	const css = `
@page{margin:16mm}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;padding:24px;background:${c.bg};color:${c.fg};font:14px/1.6 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}
h1.title{font-size:22px;margin:0 0 4px}
.meta{opacity:.65;margin:0 0 20px;font-size:12px}
.msg{padding:12px 16px;margin:0 0 12px;border-radius:12px;break-inside:avoid-page}
.msg.user{background:color-mix(in srgb,${c.accent} 12%,${c.bg});border-left:3px solid ${c.accent}}
.msg.assistant{background:color-mix(in srgb,${c.fg} 4%,${c.bg})}
.who{font-weight:600;font-size:12px;letter-spacing:.03em;text-transform:uppercase;color:${c.accent};margin-bottom:6px}
pre{background:color-mix(in srgb,${c.fg} 8%,${c.bg});padding:10px 12px;border-radius:8px;overflow:auto;white-space:pre-wrap;font:12px/1.5 "Cascadia Code",Consolas,monospace}
code{font-family:"Cascadia Code",Consolas,monospace;font-size:.92em}
:not(pre)>code{background:color-mix(in srgb,${c.fg} 8%,${c.bg});padding:1px 4px;border-radius:4px}
blockquote{margin:8px 0;padding-left:12px;border-left:3px solid color-mix(in srgb,${c.fg} 25%,${c.bg});opacity:.85}
table{border-collapse:collapse;margin:8px 0}th,td{border:1px solid color-mix(in srgb,${c.fg} 20%,${c.bg});padding:4px 8px;text-align:left}
a{color:${c.accent}}
.tools{font-size:12px;opacity:.7;margin:6px 0 0}
p{margin:6px 0}`;
	// The page is written into a same-origin frame, so besides escaping everything, forbid scripts outright.
	return `<!doctype html><html lang="${esc(snapshot.lang)}" dir="${langDir(snapshot.lang)}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${esc(title)}</title><style>${css}</style></head><body><h1 class="title">${esc(title)}</h1><p class="meta">${esc(t("export.exported"))} ${esc(new Date().toLocaleString(snapshot.lang))}</p>${body}</body></html>`;
}

/** Print through a hidden frame, so the system print dialog can save a PDF. */
function printHtml(html) {
	const frame = document.createElement("iframe");
	frame.setAttribute("aria-hidden", "true");
	frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
	document.body.appendChild(frame);
	const doc = frame.contentDocument;
	doc.open();
	doc.write(html);
	doc.close();
	setTimeout(() => {
		try {
			frame.contentWindow.focus();
			frame.contentWindow.print();
		} finally {
			setTimeout(() => frame.remove(), 60_000);
		}
	}, 300);
}

/** Export a chat: "markdown" (download), "copy" (clipboard) or "pdf" (print dialog). */
async function exportChat(sessionId, format, themed = true) {
	const id = sessionId ?? currentSessionId();
	if (!id) {
		toast(t("host.export.noSession"));
		return false;
	}
	try {
		const { messages } = await apiGet("export?session=" + encodeURIComponent(id));
		if (!messages?.length) {
			toast(t("export.empty"));
			return false;
		}
		const title = sessionTitle(id) || t("export.untitled");
		if (format === "pdf") {
			printHtml(transcriptHtml(title, messages, themed));
			return true;
		}
		const md = transcriptToMarkdown({ title, messages, locale: snapshot.lang }, { you: t("export.you"), assistant: t("export.assistant"), tools: t("export.tools"), exported: t("export.exported") });
		if (format === "copy") {
			toast(copyText(md) ? t("export.copied") : t("export.copyFailed"));
			return true;
		}
		downloadText(`${fileSlug(title)}.md`, md, "text/markdown;charset=utf-8");
		toast(t("export.saved"));
		return true;
	} catch (e) {
		toast(errorText(e));
		return false;
	}
}

/** Choose a format for exporting the chat in snapshot.exportFor. */
function ExportDialog() {
	useT();
	const sessionId = useSnap((s) => s.exportFor);
	const [themed, setThemed] = useState(true);
	const [busy, setBusy] = useState(false);
	if (!sessionId) return null;
	const close = () => setSnap({ exportFor: null });
	const run = async (format) => {
		setBusy(true);
		const ok = await exportChat(sessionId, format, themed);
		setBusy(false);
		if (ok) close();
	};
	const title = sessionTitle(sessionId);
	return h("div", { className: "st_backdrop", dir: langDir(snapshot.lang), onMouseDown: (e) => { if (e.target === e.currentTarget) close(); }, onKeyDown: (e) => { if (e.key === "Escape") close(); } },
		h("div", { className: "st_dialog", role: "dialog", "aria-label": t("export.title") },
			h("div", { className: "st_dialogTitle" }, t("export.title")),
			title ? h("p", { className: "st_hint", style: { margin: 0 } }, title) : null,
			h("div", { className: "st_exportChoices" },
				h("button", { type: "button", className: "st_exportChoice", disabled: busy, autoFocus: true, onClick: () => void run("markdown") },
					h("span", { className: "st_exportIcon", "aria-hidden": true }, "📝"), h("span", null, h("strong", null, t("export.markdown")), h("span", { className: "st_hint" }, t("export.markdownHint")))),
				h("button", { type: "button", className: "st_exportChoice", disabled: busy, onClick: () => void run("pdf") },
					h("span", { className: "st_exportIcon", "aria-hidden": true }, "🖨️"), h("span", null, h("strong", null, t("export.pdf")), h("span", { className: "st_hint" }, t("export.pdfHint")))),
				h("button", { type: "button", className: "st_exportChoice", disabled: busy, onClick: () => void run("copy") },
					h("span", { className: "st_exportIcon", "aria-hidden": true }, "📋"), h("span", null, h("strong", null, t("export.copy")), h("span", { className: "st_hint" }, t("export.copyHint"))))),
			h(Toggle, { checked: themed, onChange: setThemed, label: t("export.themed"), hint: t("export.themedHint") }),
			h("div", { className: "st_actions" }, h(Button, { onClick: close }, t("common.cancel")))));
}
//#endregion
