//#region lib/sync.js — settings backup & sync through a private GitHub Gist (host)
/**
 * Backs Studio's settings up to one private gist and restores them on any
 * machine. The GitHub token lives only on this machine (a 0600 file next to
 * the settings, or a GITHUB_TOKEN credential) and is never sent to the browser.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { StudioError, hostMessage } from "./shared.js";

const API = "https://api.github.com";
const DESCRIPTION = "DeepSeek Harness Studio settings";
const FILE = "dsh-studio-settings.json";
const LOCAL_IMAGE = "(kept on this computer)";
const AUTO_PUSH_DELAY_MS = 60 * 1000;
const TOKEN_PATTERN = /^(gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})$/;

export class GistSync {
	/**
	 * @param opts.dataDir where the token file lives
	 * @param opts.credentials () => the harness credentials service, if any
	 * @param opts.getState () => current settings
	 * @param opts.setGistId (id) => persist the gist id into settings
	 * @param opts.restore (settings) => replace settings with restored ones
	 * @param opts.version Studio version written into backups
	 */
	constructor({ dataDir, credentials, getState, setGistId, restore, version, log }) {
		this.tokenFile = join(dataDir, "github-token");
		this.dataDir = dataDir;
		this.credentials = credentials;
		this.getState = getState;
		this.setGistId = setGistId;
		this.restore = restore;
		this.version = version;
		this.log = log;
		this.login = null;
		this.lastPush = null;
		this.lastPull = null;
		this.error = null;
		this.busy = null; // "push" | "pull" | "token"
		this.timer = null;
	}

	async token() {
		try {
			if (existsSync(this.tokenFile)) {
				const saved = readFileSync(this.tokenFile, "utf8").trim();
				if (saved) return { value: saved, source: "saved" };
			}
		} catch { /* fall through */ }
		try {
			const hit = await this.credentials?.()?.resolve?.("GITHUB_TOKEN");
			if (typeof hit?.value === "string" && hit.value) return { value: hit.value, source: "credential" };
		} catch { /* no credential seam */ }
		if (process.env.GITHUB_TOKEN) return { value: process.env.GITHUB_TOKEN, source: "env" };
		return null;
	}

	async status() {
		const token = await this.token();
		const gistId = this.getState().sync.gistId;
		return {
			hasToken: Boolean(token),
			tokenSource: token?.source ?? null,
			login: this.login,
			gistId: gistId || null,
			gistUrl: gistId ? `https://gist.github.com/${gistId}` : null,
			lastPush: this.lastPush,
			lastPull: this.lastPull,
			busy: this.busy,
			error: this.error,
		};
	}

	async api(path, init = {}) {
		const token = await this.token();
		if (!token) throw new StudioError("sync.noToken", {}, "no GitHub token yet");
		const res = await fetch(API + path, {
			...init,
			headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token.value}`, "user-agent": "dsh-studio-sync", "content-type": "application/json", ...init.headers },
			signal: AbortSignal.timeout(20_000),
		});
		const body = await res.json().catch(() => null);
		if (!res.ok) {
			if (res.status === 401) throw new StudioError("sync.tokenRejected", {}, "GitHub rejected the token (it may have expired)");
			if (res.status === 403 || res.status === 404) throw new StudioError("sync.needsGist", { status: res.status }, `GitHub refused (HTTP ${res.status}); the token needs the "gist" permission`);
			throw body?.message ? new Error(body.message) : new StudioError("githubStatus", { status: res.status }, `GitHub answered ${res.status}`);
		}
		return body;
	}

	/** Check a token against GitHub, then keep it in a private file. */
	async setToken(token) {
		const value = String(token ?? "").trim();
		if (!TOKEN_PATTERN.test(value)) throw new StudioError("sync.badToken", {}, "that doesn't look like a GitHub token (they start with ghp_ or github_pat_)");
		this.busy = "token";
		try {
			const res = await fetch(`${API}/user`, { headers: { accept: "application/vnd.github+json", authorization: `Bearer ${value}`, "user-agent": "dsh-studio-sync" }, signal: AbortSignal.timeout(20_000) });
			if (!res.ok) throw res.status === 401 ? new StudioError("sync.tokenRejected", {}, "GitHub rejected that token") : new StudioError("githubStatus", { status: res.status }, `GitHub answered ${res.status}`);
			this.login = (await res.json())?.login ?? null;
			mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
			writeFileSync(this.tokenFile, value, { encoding: "utf8", mode: 0o600 });
			this.error = null;
		} finally {
			this.busy = null;
		}
	}

	clearToken() {
		try { unlinkSync(this.tokenFile); } catch { /* already gone */ }
		this.login = null;
	}

	/** Settings as uploaded: no machine cache, and images only when the user opted in. */
	payload() {
		const state = structuredClone(this.getState());
		delete state.cache;
		if (!state.sync.includeImages) {
			const strip = (v) => (typeof v === "string" && v.startsWith("data:") ? LOCAL_IMAGE : v);
			state.wallpaper.src = strip(state.wallpaper.src);
			state.identity.markImage = strip(state.identity.markImage);
			for (const look of state.looks) look.wallpaper.src = strip(look.wallpaper.src);
		}
		return { app: "dsh-studio", version: this.version, savedAt: new Date().toISOString(), settings: state };
	}

	async push() {
		this.busy = "push";
		try {
			const files = { [FILE]: { content: JSON.stringify(this.payload(), null, 2) } };
			const id = this.getState().sync.gistId || (await this.findGist());
			const gist = id
				? await this.api(`/gists/${id}`, { method: "PATCH", body: JSON.stringify({ files }) })
				: await this.api("/gists", { method: "POST", body: JSON.stringify({ description: DESCRIPTION, public: false, files }) });
			if (gist?.id && gist.id !== this.getState().sync.gistId) this.setGistId(gist.id);
			this.lastPush = Date.now();
			this.error = null;
		} catch (error) {
			this.error = hostMessage(new StudioError("sync.backupFailed", { reason: error }, `Backup failed: ${error?.message ?? error}`));
			throw error;
		} finally {
			this.busy = null;
		}
	}

	/** Find an existing backup (e.g. on a new computer) by its description and file name. */
	async findGist() {
		const list = await this.api("/gists?per_page=100");
		return (Array.isArray(list) ? list : []).find((g) => g.description === DESCRIPTION && g.files?.[FILE])?.id ?? null;
	}

	async pull() {
		this.busy = "pull";
		try {
			const id = this.getState().sync.gistId || (await this.findGist());
			if (!id) throw new StudioError("sync.noBackup", {}, "no backup found on this GitHub account yet");
			const gist = await this.api(`/gists/${id}`);
			const file = gist?.files?.[FILE];
			if (!file) throw new StudioError("sync.noFile", {}, "the backup gist has no settings file");
			let content = file.content;
			if (file.truncated && file.raw_url) content = await (await fetch(file.raw_url, { signal: AbortSignal.timeout(20_000) })).text();
			const parsed = JSON.parse(content);
			if (parsed?.app !== "dsh-studio" || !parsed.settings) throw new StudioError("sync.notStudio", {}, "that gist isn't a Studio backup");
			const local = this.getState();
			const remote = parsed.settings;
			// Images left out of the backup stay as they are on this computer.
			if (remote.wallpaper?.src === LOCAL_IMAGE) remote.wallpaper.src = local.wallpaper.src;
			if (remote.identity?.markImage === LOCAL_IMAGE) remote.identity.markImage = local.identity.markImage;
			for (const look of remote.looks ?? []) {
				if (look?.wallpaper?.src === LOCAL_IMAGE) look.wallpaper.src = local.looks.find((l) => l.id === look.id)?.wallpaper.src ?? "";
			}
			remote.cache = local.cache;
			remote.sync = { ...remote.sync, gistId: id };
			this.restore(remote);
			this.lastPull = Date.now();
			this.error = null;
		} catch (error) {
			this.error = hostMessage(new StudioError("sync.restoreFailed", { reason: error }, `Restore failed: ${error?.message ?? error}`));
			throw error;
		} finally {
			this.busy = null;
		}
	}

	/** With auto-backup on, back up a minute after the last change. */
	schedulePush() {
		if (!this.getState().sync.auto) return;
		clearTimeout(this.timer);
		this.timer = setTimeout(async () => {
			if (!(await this.token())) return;
			try { await this.push(); } catch (error) { this.log?.warn?.(`studio: ${this.error?.text ?? error}`); }
		}, AUTO_PUSH_DELAY_MS);
		this.timer.unref?.();
	}

	dispose() {
		clearTimeout(this.timer);
	}
}
//#endregion
