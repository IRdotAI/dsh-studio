//#region lib/updater.js — dsh-studio self-updater (host)
/**
 * Finds Studio's releases on GitHub and installs any of them — newer (update)
 * or older (downgrade) — through the harness's own plugin manager, the same
 * pnpm path as Plugins → Add plugin. Reinstalling an installed plugin never
 * hot-reloads it, so the chosen version takes over at the next harness restart.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, unlinkSync, renameSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions, parseVersion, StudioError, hostMessage } from "./shared.js";

const CHECK_EVERY_MS = 6 * 3600 * 1000;
const STARTUP_CHECK_DELAY_MS = 15 * 1000;
const FETCH_TIMEOUT_MS = 15 * 1000;
const KEEP_BACKUPS = 5;

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(file) {
	try {
		return JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

const manifest = readJson(join(PACKAGE_ROOT, "package.json")) ?? {};
export const CURRENT_VERSION = manifest.version ?? "0.0.0";

/** "owner/repo" from package.json's repository field, so forks update from their own releases. */
export function repoSlug() {
	const url = typeof manifest.repository === "string" ? manifest.repository : manifest.repository?.url;
	const m = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(url ?? "");
	return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * How this copy was installed. An installed copy lives at <profile>/node_modules/<name>;
 * a linked developer copy resolves to its own folder, because Node follows the link.
 */
function installSource() {
	const parent = dirname(PACKAGE_ROOT);
	if (basename(parent) !== "node_modules") return { kind: "local" };
	const spec = readJson(join(dirname(parent), "package.json"))?.dependencies?.[manifest.name];
	if (typeof spec !== "string") return { kind: "other" };
	if (/^(link|file):/.test(spec)) return { kind: "local", spec };
	if (/^(github:|git\+https:\/\/github\.com\/|https:\/\/github\.com\/)/.test(spec) || /^[\w.-]+\/[\w.-]+(#.*)?$/.test(spec)) return { kind: "github", spec };
	return { kind: "other", spec };
}

function normalise(tag) {
	const v = parseVersion(tag);
	return v ? `${v.major}.${v.minor}.${v.patch}${v.pre ? "-" + v.pre : ""}` : null;
}

function failureText(result) {
	const error = result?.error;
	const message = error?.message ?? error?.detail ?? error?.kind ?? error?.code;
	const output = String(result?.packageResult?.output ?? "").trim();
	return [message, output && output.split("\n").slice(-4).join(" ").slice(-400)].filter(Boolean).join(" — ") || `install ${result?.application ?? "failed"}`;
}

export class Updater {
	/**
	 * @param opts.dataDir folder for updates.json and settings backups
	 * @param opts.settingsFile Studio's settings file (backed up before every install)
	 * @param opts.getAuto () => whether auto-update is on
	 * @param opts.setAuto (on) => persist the auto-update setting
	 * @param opts.log harness logger
	 */
	constructor({ dataDir, settingsFile, getAuto, setAuto, log }) {
		this.dataDir = dataDir;
		this.file = join(dataDir, "updates.json");
		this.settingsFile = settingsFile;
		this.getAuto = getAuto;
		this.setAuto = setAuto;
		this.log = log;
		this.repo = repoSlug();
		this.source = installSource();
		this.pluginManager = null;
		this.status = "idle"; // idle | checking | installing
		this.error = null;
		this.installing = null; // { version, reason }
		this.restartTo = null; // version installed this session, waiting for a restart
		this.justUpdated = null; // { from, to } when this run is the result of an install
		this.checking = null;
		const saved = readJson(this.file) ?? {};
		this.releases = Array.isArray(saved.releases) ? saved.releases : [];
		this.lastCheck = Number(saved.lastCheck) || 0;
		if (saved.pending) {
			if (compareVersions(saved.pending.to, CURRENT_VERSION) === 0) this.justUpdated = { from: saved.pending.from, to: saved.pending.to };
			this.persist(null);
		}
	}

	persist(pending) {
		try {
			mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
			const tmp = `${this.file}.${process.pid}.tmp`;
			writeFileSync(tmp, JSON.stringify({ releases: this.releases, lastCheck: this.lastCheck, pending }, null, "\t"));
			renameSync(tmp, this.file);
		} catch (error) {
			this.log?.warn?.(`studio: could not save update state: ${error?.message ?? error}`);
		}
	}

	/** Why one-click installs are unavailable, or null when they work. */
	blocker() {
		if (!this.repo) return "no-repository";
		if (this.source.kind === "local") return "local-copy";
		if (this.source.kind !== "github") return "not-from-github";
		if (!this.pluginManager) return "no-plugin-manager";
		return null;
	}

	latest() {
		return this.releases.find((r) => !r.prerelease) ?? null;
	}

	snapshot() {
		const latest = this.latest();
		return {
			current: CURRENT_VERSION,
			repo: this.repo,
			source: this.source.kind,
			blocker: this.blocker(),
			releases: this.releases,
			latest: latest?.version ?? null,
			updateAvailable: Boolean(latest && compareVersions(latest.version, CURRENT_VERSION) > 0 && !this.restartTo),
			status: this.status,
			error: this.error,
			lastCheck: this.lastCheck || null,
			installing: this.installing,
			restartTo: this.restartTo,
			justUpdated: this.justUpdated,
			auto: this.getAuto(),
		};
	}

	/** Refresh the release list (at most every 6 hours unless forced), then auto-update if that's on. */
	check(force = false) {
		if (!this.repo) return Promise.resolve();
		if (this.checking) return this.checking;
		if (!force && Date.now() - this.lastCheck < CHECK_EVERY_MS) {
			this.maybeAutoUpdate();
			return Promise.resolve();
		}
		if (this.status === "idle") this.status = "checking";
		this.checking = (async () => {
			const abort = new AbortController();
			const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
			try {
				const res = await fetch(`https://api.github.com/repos/${this.repo}/releases?per_page=50`, {
					headers: { accept: "application/vnd.github+json", "user-agent": "dsh-studio-updater" },
					signal: abort.signal,
				});
				if (!res.ok) throw res.status === 403 || res.status === 429 ? new StudioError("github.rateLimit", {}, "GitHub's rate limit was reached; try again later") : new StudioError("githubStatus", { status: res.status }, `GitHub answered ${res.status}`);
				const list = await res.json();
				this.releases = (Array.isArray(list) ? list : [])
					.filter((r) => !r.draft && normalise(r.tag_name))
					.map((r) => ({
						version: normalise(r.tag_name),
						tag: String(r.tag_name),
						name: String(r.name || r.tag_name),
						notes: String(r.body ?? "").slice(0, 4000),
						publishedAt: r.published_at ?? null,
						url: r.html_url ?? null,
						prerelease: Boolean(r.prerelease),
					}))
					.sort((a, b) => compareVersions(b.version, a.version));
				this.lastCheck = Date.now();
				this.error = null;
				this.persist(null);
			} catch (error) {
				this.error = hostMessage(new StudioError("updates.checkFailed", { reason: error }, `Couldn't check for updates: ${error?.name === "AbortError" ? "GitHub took too long to answer" : error?.message ?? error}`));
			} finally {
				clearTimeout(timer);
				if (this.status === "checking") this.status = "idle";
				this.checking = null;
			}
			this.maybeAutoUpdate();
		})();
		return this.checking;
	}

	maybeAutoUpdate() {
		const latest = this.latest();
		if (!this.getAuto() || this.blocker() || this.status !== "idle" || this.restartTo) return;
		if (latest && compareVersions(latest.version, CURRENT_VERSION) > 0) {
			try {
				this.install(latest.version, "auto");
			} catch (error) {
				this.error = hostMessage(error);
			}
		}
	}

	/** Copy the settings file aside (keeping the newest few) before anything replaces Studio's code. */
	backupSettings() {
		if (!existsSync(this.settingsFile)) return null;
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const target = join(this.dataDir, `studio.backup-v${CURRENT_VERSION}-${stamp}.json`);
		copyFileSync(this.settingsFile, target);
		const backups = readdirSync(this.dataDir).filter((f) => /^studio\.backup-.*\.json$/.test(f)).sort();
		for (const old of backups.slice(0, Math.max(0, backups.length - KEEP_BACKUPS))) {
			try { unlinkSync(join(this.dataDir, old)); } catch { /* best effort */ }
		}
		return target;
	}

	/**
	 * Install one release. Returns at once; poll snapshot() for the outcome.
	 * A downgrade switches auto-update off, or it would immediately undo itself.
	 */
	install(version, reason = "manual") {
		const blocked = this.blocker();
		if (blocked) throw new StudioError("updates.blocked", { blocker: blocked }, `one-click install unavailable (${blocked})`);
		if (this.status === "installing") throw new StudioError("updates.busy", {}, "an install is already running");
		const release = this.releases.find((r) => r.version === version);
		if (!release) throw new StudioError("updates.noRelease", { version }, `v${version} isn't a published release`);
		const backup = this.backupSettings();
		if (compareVersions(version, CURRENT_VERSION) < 0 && this.getAuto()) this.setAuto(false);
		this.status = "installing";
		this.installing = { version, reason };
		this.error = null;
		const spec = `github:${this.repo}#${release.tag}`;
		this.log?.info?.(`studio: installing ${spec} (${reason})${backup ? `; settings backed up to ${backup}` : ""}`);
		(async () => {
			try {
				const result = await this.pluginManager.installBundle(spec);
				if (result?.application === "failed" || result?.application === "cancelled") throw new Error(failureText(result));
				this.restartTo = version;
				this.persist({ from: CURRENT_VERSION, to: version, at: Date.now() });
			} catch (error) {
				this.error = hostMessage(new StudioError("updates.installFailed", { version, reason: error }, `Couldn't install v${version}: ${error?.message ?? error}`));
				this.log?.warn?.(`studio: ${this.error.text}`);
			} finally {
				this.status = "idle";
				this.installing = null;
			}
		})();
	}

	/** Check shortly after startup and every 6 hours after that. Returns a disposer. */
	start() {
		const first = setTimeout(() => void this.check(false), STARTUP_CHECK_DELAY_MS);
		const every = setInterval(() => void this.check(false), CHECK_EVERY_MS);
		first.unref?.();
		every.unref?.();
		return () => {
			clearTimeout(first);
			clearInterval(every);
		};
	}
}
//#endregion
