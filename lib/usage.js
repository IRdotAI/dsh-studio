//#region lib/usage.js — dsh-studio usage recorder (host)
/**
 * Records the exact token usage of every model call by wrapping the harness's
 * `llm/stream` waterfall (the one path all model calls take) and reading the
 * stream's `usage` chunk. Records are compact and capped; the recorder can
 * never break a stream.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { dirname } from "node:path";

const MAX_RECORDS = 50_000;
const SAVE_DEBOUNCE_MS = 2000;

export class UsageLog {
	constructor(file, log) {
		this.file = file;
		this.log = log;
		this.records = [];
		this.timer = null;
		try {
			if (existsSync(file)) {
				const parsed = JSON.parse(readFileSync(file, "utf8"));
				if (Array.isArray(parsed?.records)) this.records = parsed.records;
			}
		} catch (error) {
			log?.warn?.(`studio: could not read ${file}: ${error?.message ?? error}`);
		}
	}

	add(record) {
		this.records.push(record);
		if (this.records.length > MAX_RECORDS) this.records.splice(0, this.records.length - MAX_RECORDS);
		this.scheduleSave();
	}

	clear() {
		this.records = [];
		this.save();
	}

	save() {
		try {
			mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
			const tmp = `${this.file}.${process.pid}.tmp`;
			writeFileSync(tmp, JSON.stringify({ version: 1, records: this.records }));
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

	/** The `llm/stream` waterfall listener. Passes every chunk through untouched. */
	recorder() {
		return (options, next) => {
			const started = Date.now();
			const record = { t: started, p: String(options?.provider ?? "?"), m: String(options?.model ?? "?"), a: 0, o: 0, r: 0, w: 0, d: 0, ok: true };
			let inner;
			try {
				inner = next();
			} catch (error) {
				try { this.add({ ...record, ok: false }); } catch { /* never break the harness */ }
				throw error;
			}
			const self = this;
			return (async function* () {
				let sawUsage = false;
				try {
					for await (const chunk of await inner) { // await: tolerate a listener that returns a promise
						if (chunk?.type === "usage" && chunk.usage) {
							sawUsage = true;
							record.a = chunk.usage.inputTokens | 0;
							record.o = chunk.usage.outputTokens | 0;
							record.r = chunk.usage.cacheReadTokens | 0;
							record.w = chunk.usage.cacheWriteTokens | 0;
						} else if (chunk?.type === "finish" && (chunk.reason?.kind === "error" || chunk.reason?.kind === "aborted")) {
							record.ok = false;
						}
						yield chunk;
					}
				} catch (error) {
					record.ok = false;
					throw error;
				} finally {
					record.d = Date.now() - started;
					try {
						if (sawUsage || !record.ok) self.add(record);
					} catch { /* never break the harness */ }
				}
			})();
		};
	}
}
//#endregion
