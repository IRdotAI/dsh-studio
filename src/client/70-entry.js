//#region plugin entry
/** Required service: the UI slot registry. Everything else is optional and wired when present. */
const inject = ["slots"];

function apply(ctx) {
	ctx.effect(() => {
		const tag = document.createElement("style");
		tag.dataset.plugin = PLUGIN_ID;
		tag.dataset.pluginCss = PLUGIN_ID + "/studio.css";
		tag.textContent = STUDIO_CSS;
		document.head.appendChild(tag);
		return () => tag.remove();
	}, "dsh-studio: ui stylesheet");

	ctx.effect(() => {
		const off = subscribe(applyCss);
		void load().then(() => {
			applyCss();
			scheduleTick();
		});
		const timer = setInterval(applyCss, 60 * 1000); // keeps the greeting's time of day and the slideshow current
		return () => {
			off();
			clearInterval(timer);
			if (saveTimer) { clearTimeout(saveTimer); void flushSave(); }
			styleEl?.remove();
			styleEl = null;
			lastCss = "";
		};
	}, "dsh-studio: live theme");

	ctx.effect(() => {
		const budget = setInterval(checkBudget, 5 * 60 * 1000);
		const first = setTimeout(checkBudget, 5000);
		return () => { clearInterval(budget); clearTimeout(first); };
	}, "dsh-studio: spending alerts");

	ctx.effect(() => {
		const onVisible = () => syncVideo();
		document.addEventListener("visibilitychange", onVisible);
		let off = () => {};
		try {
			for (const query of ["(prefers-reduced-transparency: reduce)", "(prefers-reduced-motion: reduce)"]) {
				const mq = window.matchMedia(query);
				mq.addEventListener("change", applyCss);
				const prev = off;
				off = () => { prev(); mq.removeEventListener("change", applyCss); };
			}
		} catch { /* no media queries */ }
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			off();
			videoEl?.remove();
			videoEl = null;
		};
	}, "dsh-studio: video wallpaper & system preferences");

	ctx.effect(() => {
		const schedule = setInterval(scheduleTick, 30 * 1000);
		// Windows accent colour and desktop wallpaper can change while the app is open.
		const env = setInterval(() => {
			if (snapshot.state.followWindows.accent || WALLPAPER_SOURCES.includes(snapshot.state.wallpaper.src)) void refreshEnv();
		}, 2 * 60 * 1000);
		const onVisible = () => {
			if (document.hidden) return;
			scheduleTick();
			if (snapshot.state.followWindows.accent) void refreshEnv();
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			clearInterval(schedule);
			clearInterval(env);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, "dsh-studio: schedule & system colours");

	ctx.effect(() => {
		let timer = null;
		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(syncGlassSelectors, 600);
		};
		let lastKey = "";
		const off = subscribe(() => {
			const key = `${snapshot.loaded}|${snapshot.state.style.material}`;
			if (key !== lastKey) {
				lastKey = key;
				schedule();
			}
		});
		const observer = new MutationObserver(schedule); // plugin stylesheets arrive as modules load
		observer.observe(document.head, { childList: true });
		return () => {
			off();
			observer.disconnect();
			clearTimeout(timer);
		};
	}, "dsh-studio: glass surface discovery");

	ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, StudioPage));
	ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({ name: "sidebar.panellist", id: PANEL_ID, order: 6, label: "Studio" }, StudioNavIcon));

	ctx.effect(() => {
		void loadUpdates();
		const afterHostCheck = setTimeout(loadUpdates, 20 * 1000); // the host's first check runs ~15 s after startup
		// Fast while installing or restarting (the page reloads itself once the new version answers),
		// every 10 s while an automatic update waits for the harness to go quiet.
		let ticks = 0;
		const busyPoll = setInterval(() => {
			const u = snapshot.updates;
			ticks++;
			if (u && (u.status !== "idle" || u.restarting || (u.restartTo && u.waitingForIdle && ticks % 10 === 0))) void loadUpdates();
		}, 1000);
		const slowPoll = setInterval(loadUpdates, 10 * 60 * 1000);
		return () => {
			clearTimeout(afterHostCheck);
			clearInterval(busyPoll);
			clearInterval(slowPoll);
		};
	}, "dsh-studio: update status");
	ctx.slots.inject("shell.overlay", () => ctx.slots.register({ name: "shell.overlay", id: "dsh-studio-palette" }, CommandPalette));
	ctx.slots.inject("conversation.input.left", () => ctx.slots.register({ name: "conversation.input.left", id: "dsh-studio-prompts", order: 90 }, PromptsButton));
	installBrandSync(ctx);

	ctx.inject(["theme"], (scope) => {
		services.theme = scope.theme;
		setSnap({ themeSnap: scope.theme.getTheme() });
		scope.on("theme/change", (snap) => setSnap({ themeSnap: snap }));
		scope.effect(() => () => { services.theme = null; }, "dsh-studio: theme service");
	});
	ctx.inject(["layout"], (scope) => {
		services.layout = scope.layout;
		scope.effect(() => () => { services.layout = null; }, "dsh-studio: layout service");
	});
	// "Auto" language follows the harness when it's switched to Chinese.
	ctx.inject(["locale"], (scope) => {
		services.locale = scope.locale;
		if (snapshot.loaded) void syncLanguage();
		scope.on("locale/change", () => void syncLanguage());
		scope.effect(() => () => { services.locale = null; }, "dsh-studio: locale service");
	});
	ctx.inject(["uiSession"], (scope) => {
		services.uiSession = scope.uiSession;
		scope.effect(() => {
			const off = watchSessions(scope.uiSession);
			return () => {
				off?.();
				services.uiSession = null;
			};
		}, "dsh-studio: task alerts");
	});
	ctx.inject(["uiWorkspace"], (scope) => {
		services.uiWorkspace = scope.uiWorkspace;
		scope.effect(() => {
			const off = watchWorkspace();
			return () => {
				off();
				services.uiWorkspace = null;
				setSnap({ workspace: { id: "", title: "", list: [] } });
			};
		}, "dsh-studio: workspace themes");
	});
	ctx.inject(["sessions"], (scope) => {
		services.sessions = scope.sessions;
		scope.effect(() => () => { services.sessions = null; }, "dsh-studio: session titles");
	});
	ctx.inject(["commandUi"], registerCommands);
}
//#endregion

exports.apply = apply;
exports.inject = inject;
