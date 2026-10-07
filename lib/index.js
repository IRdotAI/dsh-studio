//#region lib/index.js — dsh-studio host half
/**
 * Studio: themes and personalisation for DeepSeek Harness.
 *
 * Host half. Owns the settings file, serves it to the browser half over
 * authenticated /api fetch routes, injects the personalisation stylesheet into
 * every index response (so the chosen theme is there from the first paint),
 * and contributes the optional "personal preferences" system-prompt section.
 *
 * Zero npm dependencies: Node built-ins only.
 */
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve, extname } from "node:path";
import { sanitizeState, mergePatch, buildCss, personaPrompt, defaultState, usageSummary, cleanGalleryTheme, LANGUAGES } from "./shared.js";
import { Updater, CURRENT_VERSION, PACKAGE_ROOT, repoSlug } from "./updater.js";
import { UsageLog } from "./usage.js";
import { WindowsAccent } from "./windows.js";
import { GistSync } from "./sync.js";

const GALLERY_TTL_MS = 60 * 60 * 1000;

/** Unique plugin id — also the id of the bundle-patch row. */
export const name = "studio";

const SAVE_DEBOUNCE_MS = 300;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
/** Between the web-surface guidance (10100) and the deployment persona suffix (10200). */
const PROMPT_SECTION = "studio:personal-preferences";
const PROMPT_ORDER = 10150;

/** Resolve the DSH home directory (same precedence the harness uses: $DSH_HOME, then ~/.dsh). */
function dshHome() {
	const env = process.env.DSH_HOME;
	if (env && env.trim().length > 0) {
		const expanded = env.startsWith("~") ? join(homedir(), env.slice(2)) : env;
		return resolve(expanded);
	}
	return join(homedir(), ".dsh");
}

//#region Desktop integration
/** Windows keeps a copy of the current desktop wallpaper here (even after the original file is deleted). */
function desktopWallpaperPath() {
	if (process.platform !== "win32" || !process.env.APPDATA) return null;
	const file = join(process.env.APPDATA, "Microsoft", "Windows", "Themes", "TranscodedWallpaper");
	return existsSync(file) ? file : null;
}

function imageType(buf) {
	if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
	if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
	if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
	if (buf.toString("ascii", 0, 3) === "BM") return "image/bmp";
	return "application/octet-stream";
}

const FONT_TYPES = { ".woff2": "font/woff2", ".woff": "font/woff", ".otf": "font/otf", ".ttf": "font/ttf" };
const FONT_WEIGHTS = [
	[/thin|hairline/i, 100], [/extra.?light|ultra.?light/i, 200], [/light/i, 300], [/semi.?bold|demi.?bold/i, 600],
	[/extra.?bold|ultra.?bold|heavy/i, 800], [/black/i, 900], [/medium/i, 500], [/bold/i, 700],
];

/** Font files directly inside the configured folder, with weight/style read from their names. */
function listFontFaces(dir) {
	if (!dir || !dir.trim()) return [];
	try {
		const abs = resolve(dir.trim());
		return readdirSync(abs)
			.filter((name) => FONT_TYPES[extname(name).toLowerCase()])
			.slice(0, 16)
			.map((name) => ({
				file: name,
				url: `/api/studio/font?f=${encodeURIComponent(name)}`,
				weight: FONT_WEIGHTS.find(([re]) => re.test(name))?.[1] ?? 400,
				style: /italic|oblique/i.test(name) ? "italic" : "normal",
			}));
	} catch {
		return [];
	}
}
//#endregion

function loggerOf(ctx) {
	const raw = ctx.logger;
	if (typeof raw === "function") {
		try { return raw("studio"); } catch { /* fall through */ }
	}
	return raw ?? console;
}

//#region Store
class Store {
	constructor(file, log) {
		this.file = file;
		this.log = log;
		this.state = defaultState();
		this.timer = null;
		this.load();
	}

	load() {
		try {
			if (!existsSync(this.file)) return;
			this.state = sanitizeState(JSON.parse(readFileSync(this.file, "utf8")));
		} catch (error) {
			this.log?.warn?.(`studio: could not read ${this.file}: ${error?.message ?? error}`);
		}
	}

	save() {
		try {
			mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
			const tmp = `${this.file}.${process.pid}.tmp`;
			writeFileSync(tmp, JSON.stringify(this.state, null, "\t"), "utf8");
			renameSync(tmp, this.file);
		} catch (error) {
			this.log?.warn?.(`studio: could not write ${this.file}: ${error?.message ?? error}`);
		}
	}

	scheduleSave() {
		if (this.timer) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.save();
		}, SAVE_DEBOUNCE_MS);
		this.timer.unref?.();
	}

	flush() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
			this.save();
		}
	}
}
//#endregion

//#region Plugin entry
/**
 * Plugin entry. Registers:
 *  - the first-paint stylesheet on every index response
 *  - the personal-preferences system-prompt section (empty unless enabled)
 *  - authenticated /api/studio/* routes for the browser half
 */
export function apply(ctx) {
	const log = loggerOf(ctx);
	const file = join(dshHome(), "studio", "studio.json");
	const store = new Store(file, log);
	ctx.effect(() => () => store.flush(), "studio: flush settings");

	// ---- usage: exact tokens of every model call ---------------------------------
	const usage = new UsageLog(join(dirname(file), "usage.json"), log);
	try {
		ctx.on("llm/stream", usage.recorder(), { global: true });
	} catch (error) {
		log?.warn?.(`studio: usage recording unavailable: ${error?.message ?? error}`);
	}
	ctx.effect(() => () => usage.flush(), "studio: flush usage");

	// ---- desktop integration ------------------------------------------------------
	const accent = new WindowsAccent();
	ctx.effect(() => accent.start(), "studio: Windows accent");
	let credentials = null;
	ctx.inject(["credentials"], (child) => {
		credentials = child.credentials;
		child.effect(() => () => { credentials = null; }, "studio: credentials handle");
	});

	// ---- first paint ----------------------------------------------------------
	const fontFaces = () => (store.state.style.uiFont === "folder" ? listFontFaces(store.state.style.fontDir) : []);
	/** What this machine offers the browser half. */
	const env = () => ({ desktopWallpaper: desktopWallpaperPath() !== null, fontFaces: fontFaces(), windowsAccent: accent.value });

	/** The greeting's language at first paint: the one picked in Studio ("auto" is resolved in the browser). */
	const dictionaries = new Map();
	const greetingLang = () => {
		const code = store.state.language === "auto" ? "en" : store.state.language;
		if (!dictionaries.has(code)) {
			try {
				dictionaries.set(code, JSON.parse(readFileSync(join(PACKAGE_ROOT, "locales", `${code}.json`), "utf8")));
			} catch {
				dictionaries.set(code, {});
			}
		}
		const dict = dictionaries.get(code);
		return { tr: (key) => dict[key], locale: code };
	};

	ctx.on("webserver/index-inject", (table) => {
		try {
			table.push({ kind: "style", text: buildCss(store.state, { fontFaces: fontFaces(), windowsAccent: accent.value, greetingLang: greetingLang() }) });
		} catch (error) {
			log?.warn?.(`studio: could not build the stylesheet: ${error?.message ?? error}`);
		}
	});

	// ---- personal preferences in the system prompt ------------------------------
	// Re-registered whenever the rendered text changes so the registry emits
	// system-prompt/change and the next assembly picks it up.
	let reregisterPrompt = () => {};
	ctx.inject(["systemPrompt"], (child) => {
		let dispose = null;
		const register = () => {
			dispose?.();
			dispose = child.systemPrompt.section({
				name: PROMPT_SECTION,
				order: PROMPT_ORDER,
				interpolate: false,
				text: () => personaPrompt(store.state),
			});
		};
		register();
		reregisterPrompt = register;
		child.effect(() => () => { reregisterPrompt = () => {}; }, "studio: prompt section handle");
	});

	const commit = (next) => {
		const promptBefore = personaPrompt(store.state);
		const autoBefore = store.state.updates.auto;
		store.state = next;
		store.scheduleSave();
		if (personaPrompt(next) !== promptBefore) {
			try { reregisterPrompt(); } catch (error) { log?.warn?.(`studio: prompt section refresh failed: ${error?.message ?? error}`); }
		}
		if (next.updates.auto && !autoBefore) void updater.check(true); // switching auto-update on checks right away
		sync.schedulePush();
	};

	// ---- backup & sync ------------------------------------------------------------
	const sync = new GistSync({
		dataDir: dirname(file),
		credentials: () => credentials,
		getState: () => store.state,
		setGistId: (id) => commit(sanitizeState(mergePatch(store.state, { sync: { gistId: id } }))),
		restore: (settings) => commit(sanitizeState(settings)),
		version: CURRENT_VERSION,
		log,
	});
	ctx.effect(() => () => sync.dispose(), "studio: sync timer");

	// ---- community gallery ----------------------------------------------------------
	let gallery = { at: 0, themes: [], error: null };
	async function loadGallery(force) {
		if (!force && Date.now() - gallery.at < GALLERY_TTL_MS && gallery.themes.length) return gallery;
		const repo = repoSlug();
		try {
			const res = await fetch(`https://raw.githubusercontent.com/${repo}/main/gallery/index.json`, { headers: { "user-agent": "dsh-studio" }, signal: AbortSignal.timeout(15_000) });
			if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
			const body = await res.json();
			gallery = { at: Date.now(), themes: (Array.isArray(body?.themes) ? body.themes : []).map(cleanGalleryTheme).filter(Boolean).slice(0, 500), error: null };
		} catch (error) {
			gallery = { ...gallery, error: `Couldn't load the gallery: ${error?.message ?? error}` };
		}
		return gallery;
	}

	// ---- DeepSeek balance (optional) -------------------------------------------------
	async function deepseekBalance() {
		const envName = store.state.usage.balanceEnv;
		let key = null;
		try { key = (await credentials?.resolve?.(envName))?.value ?? null; } catch { /* no credential seam */ }
		key ??= process.env[envName] ?? null;
		if (!key) return { error: `no ${envName} key is set up` };
		const res = await fetch("https://api.deepseek.com/user/balance", { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
		const body = await res.json().catch(() => null);
		if (!res.ok) return { error: `DeepSeek answered ${res.status}` };
		const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
		return { available: Boolean(body?.is_available), balances: infos.map((i) => ({ currency: String(i.currency), total: Number(i.total_balance) })), at: Date.now() };
	}

	// ---- updates ----------------------------------------------------------------
	const updater = new Updater({
		dataDir: dirname(file),
		settingsFile: file,
		getAuto: () => store.state.updates.auto,
		setAuto: (on) => commit(sanitizeState(mergePatch(store.state, { updates: { auto: on } }))),
		log,
	});
	ctx.inject(["pluginManager"], (child) => {
		updater.pluginManager = child.pluginManager;
		child.effect(() => () => { updater.pluginManager = null; }, "studio: plugin manager handle");
	});
	ctx.effect(() => updater.start(), "studio: update checks");

	// ---- authenticated fetch routes -------------------------------------------
	const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

	async function readJson(request) {
		const text = await request.text();
		if (text.length > MAX_BODY_BYTES) throw new Error("request too large");
		return text ? JSON.parse(text) : {};
	}

	// Connection keys exact routes by path alone, and a streaming route cannot take GET
	// (the bridge always attaches a body), so reads and writes live on separate paths.
	const routes = [
		{
			path: "/api/studio/state",
			methods: ["GET"],
			requestBody: "buffered",
			fetch: async () => json({ state: store.state, file, env: env() }),
		},
		{
			// Partial patch: objects deep-merge, arrays replace. Streaming so a wallpaper upload is not held to the JSON cap.
			path: "/api/studio/patch",
			methods: ["POST"],
			requestBody: "streaming",
			fetch: async (request) => {
				let patch;
				try { patch = await readJson(request); } catch (error) { return json({ error: String(error?.message ?? error) }, 400); }
				if (!patch || typeof patch !== "object" || Array.isArray(patch)) return json({ error: "body must be a JSON object" }, 400);
				commit(sanitizeState(mergePatch(store.state, patch)));
				return json({ ok: true, state: store.state, env: env() });
			},
		},
		{
			// Whole-state replace (import).
			path: "/api/studio/replace",
			methods: ["POST"],
			requestBody: "streaming",
			fetch: async (request) => {
				let body;
				try { body = await readJson(request); } catch (error) { return json({ error: String(error?.message ?? error) }, 400); }
				commit(sanitizeState(body));
				return json({ ok: true, state: store.state, env: env() });
			},
		},
		{
			// The live Windows desktop wallpaper, so "use my desktop wallpaper" follows wallpaper changes.
			path: "/api/studio/desktop-wallpaper",
			methods: ["GET"],
			requestBody: "buffered",
			fetch: async (request) => {
				const path = desktopWallpaperPath();
				if (!path) return new Response("no desktop wallpaper", { status: 404 });
				const tag = `"${Math.round(statSync(path).mtimeMs)}"`;
				if (request.headers.get("if-none-match") === tag) return new Response(null, { status: 304, headers: { etag: tag } });
				const body = readFileSync(path);
				return new Response(body, { headers: { "content-type": imageType(body), "cache-control": "no-cache", etag: tag } });
			},
		},
		{
			// Only files listed in the configured font folder are served — never an arbitrary path.
			path: "/api/studio/font",
			methods: ["GET"],
			requestBody: "buffered",
			fetch: async (request) => {
				const name = new URL(request.url).searchParams.get("f") ?? "";
				const face = fontFaces().find((f) => f.file === name);
				if (!face) return new Response("not found", { status: 404 });
				const body = readFileSync(join(resolve(store.state.style.fontDir.trim()), face.file));
				return new Response(body, { headers: { "content-type": FONT_TYPES[extname(face.file).toLowerCase()], "cache-control": "max-age=86400" } });
			},
		},
		{
			// GET: version, releases and update status. POST { action: "check" } or { action: "install", version }.
			path: "/api/studio/updates",
			methods: ["GET", "POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				if (request.method === "POST") {
					let body;
					try { body = await readJson(request); } catch { body = null; }
					try {
						if (body?.action === "check") await updater.check(true);
						else if (body?.action === "install" && typeof body.version === "string") updater.install(body.version);
						else return json({ error: "pass { \"action\": \"check\" } or { \"action\": \"install\", \"version\": \"x.y.z\" }" }, 400);
					} catch (error) {
						return json({ error: String(error?.message ?? error), updates: updater.snapshot() }, 409);
					}
				}
				return json(updater.snapshot());
			},
		},
		{
			// GET: totals, per-model and per-day usage plus recent calls. POST { action: "clear" | "balance" }.
			path: "/api/studio/usage",
			methods: ["GET", "POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				if (request.method === "POST") {
					let body;
					try { body = await readJson(request); } catch { body = null; }
					if (body?.action === "clear") usage.clear();
					else if (body?.action === "balance") {
						try { return json(await deepseekBalance()); } catch (error) { return json({ error: String(error?.message ?? error) }); }
					} else return json({ error: "pass { \"action\": \"clear\" } or { \"action\": \"balance\" }" }, 400);
				}
				const records = usage.records;
				return json({
					summary: usageSummary(records, store.state.usage.prices),
					recent: records.slice(-25).reverse(),
					since: records[0]?.t ?? null,
					count: records.length,
				});
			},
		},
		{
			// GET: sync status (never the token). POST { action: "set-token", token } | "clear-token" | "push" | "pull".
			path: "/api/studio/sync",
			methods: ["GET", "POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				if (request.method === "POST") {
					let body;
					try { body = await readJson(request); } catch { body = null; }
					try {
						if (body?.action === "set-token") await sync.setToken(body.token);
						else if (body?.action === "clear-token") sync.clearToken();
						else if (body?.action === "push") await sync.push();
						else if (body?.action === "pull") await sync.pull();
						else return json({ error: "unknown action" }, 400);
					} catch (error) {
						return json({ error: String(error?.message ?? error), sync: await sync.status(), state: store.state }, 409);
					}
					return json({ sync: await sync.status(), state: store.state, env: env() });
				}
				return json({ sync: await sync.status() });
			},
		},
		{
			path: "/api/studio/gallery",
			methods: ["GET", "POST"],
			requestBody: "buffered",
			fetch: async (request) => json({ ...(await loadGallery(request.method === "POST")), repo: repoSlug() }),
		},
		{
			// Interface translations, read from the package's locales folder.
			path: "/api/studio/locale",
			methods: ["GET"],
			requestBody: "buffered",
			fetch: async (request) => {
				const lang = new URL(request.url).searchParams.get("lang") ?? "";
				if (!LANGUAGES.some((l) => l.code === lang)) return json({ error: "unknown language" }, 404);
				try {
					return new Response(readFileSync(join(PACKAGE_ROOT, "locales", `${lang}.json`)), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-cache" } });
				} catch {
					return json({ error: "missing translation" }, 404);
				}
			},
		},
		{
			path: "/api/studio/reset",
			methods: ["POST"],
			requestBody: "buffered",
			fetch: async (request) => {
				let body;
				try { body = await readJson(request); } catch { body = null; }
				if (body?.confirm !== "reset-studio") return json({ error: "pass { \"confirm\": \"reset-studio\" }" }, 400);
				commit(defaultState());
				return json({ ok: true, state: store.state, env: env() });
			},
		},
	];

	ctx.inject(["connection"], (child) => {
		for (const route of routes) child.effect(() => child.connection.fetch.register(route), `studio: ${route.methods.join("/")} ${route.path}`);
	});

	log?.info?.(`studio: settings at ${file}; serving /api/studio/*`);
}
//#endregion
//#endregion
