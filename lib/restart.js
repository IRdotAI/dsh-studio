//#region lib/restart.js — restart the harness so an update takes effect
/**
 * The plugin manager never hot-swaps an installed plugin, so a new Studio
 * version only runs in a fresh harness process. Restarting works like this:
 * the harness shuts down the way Ctrl+C does (sessions saved, plugins and the
 * web server closed), but where its shutdown would end with process.exit(),
 * this process stays on and starts `dsh web` again with the exact same command
 * line, as its child. That keeps the new harness on the same console or log
 * file and inside whatever started it (a terminal, where Ctrl+C still stops
 * it, or the desktop launcher, which can still stop it) — on Windows a
 * process started any other way would either be killed with its parent or
 * lose the console. This process exits when the new harness does.
 * Open pages reload by themselves once the new version answers.
 */
import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

/**
 * The arguments that start this harness again, or null when it wasn't started
 * by the dsh command line (a desktop app or a test runner restarts itself).
 */
export function relaunchArgs(argv = process.argv, execArgv = process.execArgv) {
	const bin = String(argv[1] ?? "");
	if (!/[\\/]@deepseek-ai[\\/]dsh[\\/]lib[\\/]bin\.js$/.test(bin)) return null;
	const args = argv.slice(2);
	if (!args.includes("web")) return null;
	// The pages already open reload by themselves, so a restart must not open another browser tab.
	if (!args.includes("--no-open")) args.push("--no-open");
	return [...execArgv, bin, ...args];
}

export const canRestart = () => relaunchArgs() !== null;

/** Exit code dsh uses when the profile fails to start (e.g. the port isn't free yet); worth a retry. */
const STARTUP_FAILED = 1;

/**
 * Run `node <args>` as this process's child once `process.exit` is called, and
 * exit with its code when it ends. Exported for tests (`proc` and `spawnFn` are
 * stand-ins there).
 */
export function exitIntoChild(args, { proc = process, spawnFn = spawn, note = () => {}, retries = 3, retryMs = 2000, startDelayMs = 500 } = {}) {
	const realExit = proc.exit.bind(proc);
	let child = null;
	let tries = 0;
	const start = () => {
		const startedAt = Date.now();
		child = spawnFn(proc.execPath, args, { stdio: "inherit", windowsHide: true, cwd: proc.cwd(), env: proc.env });
		note(`restarted the harness (pid ${child.pid ?? "?"})`);
		child.on("error", (error) => {
			note(`couldn't start the harness again: ${error.message}`);
			realExit(1);
		});
		child.on("exit", (code, signal) => {
			// A quick startup failure usually means the old harness hadn't let go of the port yet.
			if (code === STARTUP_FAILED && Date.now() - startedAt < 20_000 && ++tries < retries) {
				note("the harness didn't start; trying again");
				setTimeout(start, retryMs);
				return;
			}
			realExit(code ?? (signal ? 1 : 0));
		});
	};
	// The harness's shutdown ends in process.exit(); from now on that starts the new harness
	// instead (once — later calls, e.g. a second Ctrl+C, just wait for the child to end).
	proc.exit = () => {
		if (!child) {
			child = {}; // claimed
			setTimeout(start, startDelayMs);
		}
	};
}

/**
 * Restart now: shut the harness down gracefully, then start it again in this process's place.
 * @returns false when this harness can't be restarted (then nothing happens)
 */
export function restartHarness({ log, logFile } = {}) {
	const args = relaunchArgs();
	if (!args) return false;
	const note = (text) => {
		if (!logFile) return;
		try { appendFileSync(logFile, `${new Date().toISOString()} ${text}\n`); } catch { /* best effort */ }
	};
	exitIntoChild(args, { note });
	log?.info?.("studio: restarting DeepSeek Harness to finish an update");
	note(`restarting the harness (pid ${process.pid}) to finish an update`);
	// Emitting the signal runs the harness's own graceful shutdown; that also works on
	// Windows, where a process can't send itself a real signal.
	setTimeout(() => process.emit("SIGTERM", "SIGTERM"), 400);
	return true;
}
//#endregion
