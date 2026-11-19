import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as PrimaryButton, m as inputClass, r as Panel, t as Field, u as getCatalog, y as placeOrder } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mass-B5dh4Yuy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MassPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MassOrder, {}) });
}
function MassOrder() {
	const [bundles, setBundles] = (0, import_react.useState)([]);
	const [bundleId, setBundleId] = (0, import_react.useState)("");
	const [base, setBase] = (0, import_react.useState)(1e4);
	const [links, setLinks] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	const [done, setDone] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		getCatalog().then((catalog) => {
			setBundles(catalog.bundles);
			if (catalog.bundles[0]) setBundleId(catalog.bundles[0].id);
		}).catch((err) => setError(err instanceof Error ? err.message : "Catalog failed."));
	}, []);
	const bundle = bundles.find((row) => row.id === bundleId);
	async function submit() {
		if (!bundle) return;
		const urls = links.split(/\n+/).map((line) => line.trim()).filter(Boolean);
		if (urls.length === 0) {
			setError("Add at least one link.");
			return;
		}
		if (urls.some((url) => !/^https?:\/\//i.test(url))) {
			setError("Every line needs an http or https link.");
			return;
		}
		setPending(true);
		setError("");
		setDone([]);
		const placed = [];
		try {
			for (const link of urls) {
				const result = await placeOrder({ data: {
					bundleId: bundle.id,
					link,
					baseQuantity: base,
					organic: true,
					intervalHours: 1,
					variancePercent: 20,
					enabledTypes: bundle.items.map((item) => item.engagement_type)
				} });
				placed.push(result.order_number ?? result.id);
			}
			setDone(placed);
			setLinks("");
		} catch (err) {
			setDone(placed);
			setError(err instanceof Error ? err.message : "A row failed.");
		} finally {
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-3xl space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary",
					children: "Batch"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 text-3xl",
					children: "Mass order"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-mute",
					children: "One link per line. Each row is a separate ledger cue. Nothing is sent upstream."
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Bundle",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							className: inputClass,
							value: bundleId,
							onChange: (e) => setBundleId(e.target.value),
							children: bundles.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
								value: row.id,
								children: [
									row.platform,
									" · ",
									row.name
								]
							}, row.id))
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Base views",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: inputClass,
							inputMode: "numeric",
							value: base,
							onChange: (e) => setBase(Number(e.target.value.replace(/\D/g, "")) || 0)
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Links",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							className: `${inputClass} min-h-40`,
							value: links,
							onChange: (e) => setLinks(e.target.value),
							placeholder: "https://\nhttps://"
						})
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-destructive",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
						type: "button",
						disabled: pending || !bundle,
						onClick: submit,
						children: pending ? "Placing…" : "Place batch"
					})
				]
			}),
			done.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-lg",
				children: "Queued"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-2 text-sm",
				children: done.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/orders",
					className: "font-semibold text-primary",
					children: id
				}) }, id))
			})] })
		]
	});
}
//#endregion
export { MassPage as component };
