//#region brand occupants
function BrandName() {
	const appName = useSnap((s) => s.state.identity.appName);
	return h("span", { className: "st_brandName", title: appName }, appName);
}

function BrandMark({ size, className }) {
	const identity = useSnap((s) => s.state.identity);
	const mark = h(MarkPreview, { identity, size: size ?? 24 });
	return className ? h("span", { className, style: { display: "inline-flex" } }, mark) : mark;
}

/** Occupy the brand slots (shadowing the originals) only while the user has set something. */
function installBrandSync(ctx) {
	let offName = null;
	let offMarks = null;
	let prev = { name: false, mark: false };
	const sync = () => {
		const id = snapshot.state.identity;
		const want = {
			name: snapshot.loaded && id.appName.trim().length > 0,
			mark: snapshot.loaded && (id.mark === "emoji" || id.mark === "monogram" || (id.mark === "image" && Boolean(id.markImage))),
		};
		if (want.name !== prev.name) {
			offName?.();
			offName = want.name
				? ctx.slots.inject("sidebar.brand.name", () => ctx.slots.register({ name: "sidebar.brand.name", priority: -10 }, BrandName))
				: null;
		}
		if (want.mark !== prev.mark) {
			offMarks?.();
			if (want.mark) {
				const a = ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.register({ name: "sidebar.brand.mark", priority: -10 }, BrandMark));
				const b = ctx.slots.inject("conversation.hero.brand.mark", () => ctx.slots.register({ name: "conversation.hero.brand.mark", priority: -10 }, BrandMark));
				offMarks = () => { a(); b(); };
			} else {
				offMarks = null;
			}
		}
		prev = want;
	};
	ctx.effect(() => {
		sync();
		const off = subscribe(sync);
		return () => {
			off();
			offName?.();
			offMarks?.();
			offName = offMarks = null;
			prev = { name: false, mark: false };
		};
	}, "dsh-studio: brand occupants");
}
//#endregion
