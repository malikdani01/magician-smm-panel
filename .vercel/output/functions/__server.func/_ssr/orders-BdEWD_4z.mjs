import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { g as listOrders, h as inr, r as Panel } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/orders-BdEWD_4z.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OrdersPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Orders, {}) });
}
function Orders() {
	const [rows, setRows] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		listOrders().then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Could not load orders."));
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold uppercase tracking-widest text-primary",
				children: "Orders"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 text-4xl",
				children: "Ledger"
			})] }),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-destructive",
				children: error
			}),
			!rows && !error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mute",
				children: "Loading orders…"
			}),
			rows && rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mute",
				children: "No cues yet."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/order",
				className: "mt-3 inline-flex text-sm font-semibold text-primary",
				children: "Build the first one"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-3",
				children: rows?.map((order) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/orders/$id",
					params: { id: order.id },
					className: "block",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
						className: "flex flex-wrap items-center justify-between gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-semibold",
								children: order.order_number
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs uppercase tracking-widest text-mute",
								children: [
									order.platform,
									" · ",
									order.status
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "max-w-xs truncate text-sm text-mute",
								children: order.link
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-2xl",
								children: inr(order.total_paise)
							})
						]
					})
				}, order.id))
			})
		]
	});
}
//#endregion
export { OrdersPage as component };
