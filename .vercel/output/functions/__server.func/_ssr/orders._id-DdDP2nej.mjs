import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { b as simulateDelivery, f as getOrder, h as inr, i as PrimaryButton, r as Panel } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
import { n as Route$1 } from "./router-BCDs3V4F.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/orders._id-DdDP2nej.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DetailPage() {
	const { id } = Route$1.useParams();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Detail, { id }) });
}
function Detail({ id }) {
	const [order, setOrder] = (0, import_react.useState)(void 0);
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	function load() {
		getOrder({ data: id }).then(setOrder).catch((err) => setError(err instanceof Error ? err.message : "Missing order."));
	}
	(0, import_react.useEffect)(() => {
		load();
	}, [id]);
	async function simulate() {
		setPending(true);
		setError("");
		try {
			await simulateDelivery({ data: id });
			load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not simulate.");
		} finally {
			setPending(false);
		}
	}
	if (order === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-mute",
		children: "Loading cue…"
	});
	if (!order) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-destructive",
		children: error || "That cue is not on your ledger."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/orders",
				className: "text-sm font-semibold text-primary",
				children: "Back to ledger"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-semibold uppercase tracking-widest text-primary",
					children: order.platform
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 text-4xl",
					children: order.order_number
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-4xl",
					children: inr(order.total_paise)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				className: "space-y-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "break-all",
					children: order.link
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-mute",
					children: [
						"Status ",
						order.status,
						" · provider ",
						order.provider_state,
						order.organic ? ` · every ${order.interval_hours}h · ±${order.variance_percent}%` : ""
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-2",
				children: order.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-widest text-mute",
						children: item.engagement_type
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-1 text-2xl",
						children: item.service_name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-mute",
						children: [
							item.delivered.toLocaleString("en-IN"),
							" / ",
							item.quantity.toLocaleString("en-IN"),
							" · ",
							inr(item.price_paise),
							" · ",
							item.status
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 h-2 overflow-hidden rounded-full bg-secondary",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-full bg-primary",
							style: { width: `${item.quantity ? Math.round(item.delivered / item.quantity * 100) : 0}%` }
						})
					})
				] }, item.id))
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-destructive",
				children: error
			}),
			order.status === "queued" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
				type: "button",
				disabled: pending,
				onClick: simulate,
				children: pending ? "Updating…" : "Simulate delivery"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-mute",
				children: "Simulation only marks the ledger complete. No network is contacted."
			})
		]
	});
}
//#endregion
export { DetailPage as component };
