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
import { sanitizeState, mergePatch, buildCss, personaPrompt, defaultState } from "./shared.js";

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

	// ---- first paint ----------------------------------------------------------
	const fontFaces = () => (store.state.style.uiFont === "folder" ? listFontFaces(store.state.style.fontDir) : []);
	/** What this machine offers the browser half: the desktop wallpaper and any served fonts. */
	const env = () => ({ desktopWallpaper: desktopWallpaperPath() !== null, fontFaces: fontFaces() });

	ctx.on("webserver/index-inject", (table) => {
		try {
			table.push({ kind: "style", text: buildCss(store.state, { fontFaces: fontFaces() }) });
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
		store.state = next;
		store.scheduleSave();
		if (personaPrompt(next) !== promptBefore) {
			try { reregisterPrompt(); } catch (error) { log?.warn?.(`studio: prompt section refresh failed: ${error?.message ?? error}`); }
		}
	};

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
