import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as inr, r as Panel, u as getCatalog } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/catalog-Bz7fdl6p.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CatalogPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Catalog, {}) });
}
function Catalog() {
	const [services, setServices] = (0, import_react.useState)([]);
	const [bundles, setBundles] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		getCatalog().then((catalog) => {
			setServices(catalog.services);
			setBundles(catalog.bundles);
		}).catch((err) => setError(err instanceof Error ? err.message : "Catalog failed."));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-semibold uppercase tracking-widest text-primary",
					children: "Services"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 text-4xl",
					children: "The book"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 max-w-2xl text-sm text-mute",
					children: "Prices are per 1,000 and live in this desk. Provider ids are not attached."
				})
			] }),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-3",
				children: bundles.map((bundle) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-bold uppercase tracking-widest text-primary",
						children: bundle.platform
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-1 text-2xl",
						children: bundle.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-mute",
						children: bundle.tagline
					})
				] }, bundle.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[640px] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-xs uppercase tracking-widest text-mute",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-semibold",
								children: "Line"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-semibold",
								children: "Platform"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-semibold",
								children: "Per 1k"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 font-semibold",
								children: "Range"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: services.map((service) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-line",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 font-semibold",
								children: service.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3 capitalize text-mute",
								children: service.platform
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-3",
								children: inr(service.price_per_1k_paise)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "py-3 text-mute",
								children: [
									service.min_quantity.toLocaleString("en-IN"),
									" – ",
									service.max_quantity.toLocaleString("en-IN")
								]
							})
						]
					}, service.id)) })]
				})
			})
		]
	});
}
//#endregion
export { CatalogPage as component };
