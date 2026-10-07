//#region lib/windows.js — Windows accent colour (host)
/**
 * Reads the Windows accent colour from the registry (HKCU …\DWM\AccentColor,
 * stored as 0xAABBGGRR) and keeps it fresh, so "use my Windows accent" follows
 * personalisation changes. Returns null on other systems or when unavailable.
 */
import { execFile, execFileSync } from "node:child_process";

const REFRESH_MS = 60 * 1000;
const KEY = "HKCU\\Software\\Microsoft\\Windows\\DWM";

function parse(output) {
	const m = /AccentColor\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(String(output));
	if (!m) return null;
	const abgr = parseInt(m[1], 16) >>> 0;
	const hex = (n) => n.toString(16).padStart(2, "0");
	return `#${hex(abgr & 0xff)}${hex((abgr >>> 8) & 0xff)}${hex((abgr >>> 16) & 0xff)}`;
}

export class WindowsAccent {
	constructor() {
		this.value = null;
		if (process.platform !== "win32") return;
		try {
			this.value = parse(execFileSync("reg", ["query", KEY, "/v", "AccentColor"], { encoding: "utf8", timeout: 3000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }));
		} catch {
			this.value = null;
		}
	}

	/** Re-read every minute. Returns a disposer. */
	start() {
		if (process.platform !== "win32") return () => {};
		const timer = setInterval(() => {
			execFile("reg", ["query", KEY, "/v", "AccentColor"], { timeout: 3000, windowsHide: true }, (error, stdout) => {
				if (!error) this.value = parse(stdout) ?? this.value;
			});
		}, REFRESH_MS);
		timer.unref?.();
		return () => clearInterval(timer);
	}
}
//#endregion
