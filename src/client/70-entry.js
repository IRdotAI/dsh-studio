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
		const timer = setInterval(applyCss, 5 * 60 * 1000); // keeps the greeting's time of day current
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
		const schedule = setInterval(scheduleTick, 30 * 1000);
		// Windows accent colour and desktop wallpaper can change while the app is open.
		const env = setInterval(() => {
			if (snapshot.state.followWindows.accent || snapshot.state.wallpaper.src === DESKTOP_WALLPAPER) void refreshEnv();
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
		const busyPoll = setInterval(() => {
			if (snapshot.updates && snapshot.updates.status !== "idle") void loadUpdates();
		}, 1500);
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
	ctx.inject(["commandUi"], registerCommands);
}
//#endregion

exports.apply = apply;
exports.inject = inject;
