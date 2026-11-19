import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { O as ArrowUpRight, c as Sparkles, j as Activity, l as ShoppingCart, o as TrendingUp, r as Wallet, t as Zap, y as Library } from "../_libs/lucide-react.mjs";
import { d as getDashboard, h as inr, x as useCurrentUserState } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-BhL1oSfC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DashboardPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dashboard, {}) });
}
function greeting() {
	const hour = (/* @__PURE__ */ new Date()).getHours();
	if (hour < 12) return "morning";
	if (hour < 18) return "afternoon";
	return "evening";
}
function Dashboard() {
	const { user } = useCurrentUserState();
	const [data, setData] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		getDashboard().then(setData).catch((err) => setError(err instanceof Error ? err.message : "Could not load the desk."));
	}, []);
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-destructive",
		children: error
	});
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-mute",
		children: "Loading the desk…"
	});
	const cards = [
		{
			icon: Wallet,
			label: "Balance",
			value: inr(data.balance_paise),
			sub: "Available credit",
			accent: "#16a34a"
		},
		{
			icon: ShoppingCart,
			label: "Total orders",
			value: String(data.order_count),
			sub: `${data.order_count - data.queued_count} settled`,
			accent: "#3b82f6"
		},
		{
			icon: Activity,
			label: "Active",
			value: String(data.queued_count),
			sub: "Still queued",
			accent: "#f59e0b"
		},
		{
			icon: TrendingUp,
			label: "Total spent",
			value: inr(data.spend_paise),
			sub: "All time",
			accent: "#2563eb"
		}
	];
	const actions = [
		{
			to: "/order",
			icon: Sparkles,
			label: "Full engagement",
			desc: "Views plus extras"
		},
		{
			to: "/wallet",
			icon: Zap,
			label: "Add credit",
			desc: "Studio wallet"
		},
		{
			to: "/catalog",
			icon: Library,
			label: "Services",
			desc: "Browse the book"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mb-0.5 text-[12px] font-medium text-mute",
					children: [
						"Good ",
						greeting(),
						","
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-3xl italic",
					children: user?.displayName || "Member"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/order",
						className: "inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-card px-4 text-[12px] font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3.5 text-primary" }), " Engagement"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/mass",
						className: "inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-semibold text-primary-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-3.5" }), " Mass order"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-4 lg:grid-cols-4",
				children: cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "rounded-xl border border-line bg-card p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-3 grid size-9 place-items-center rounded-lg",
							style: {
								background: `${card.accent}1f`,
								color: card.accent
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(card.icon, { className: "size-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-1 text-[10px] font-semibold uppercase tracking-wider text-mute",
							children: card.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-2xl font-extrabold tracking-tight",
							children: card.value
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[11px] text-mute",
							children: card.sub
						})
					]
				}, card.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 lg:grid-cols-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-xl border border-line bg-card p-5 lg:col-span-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-4 flex items-center justify-between border-b border-line pb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-base font-semibold",
								children: "Recent orders"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/orders",
								className: "inline-flex items-center gap-1 text-xs font-semibold text-primary",
								children: ["View all ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3" })]
							})]
						}),
						data.recent.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "py-8 text-center text-sm text-mute",
							children: "No orders yet"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-2",
							children: data.recent.map((order) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/orders/$id",
								params: { id: order.id },
								className: "flex items-center justify-between gap-3 rounded-lg bg-[#f0f9ff] px-3 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-semibold",
									children: order.order_number
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[10px] uppercase tracking-widest text-slate-400",
									children: order.platform
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block text-sm font-semibold",
										children: inr(order.total_paise)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] font-semibold uppercase tracking-wider text-primary",
										children: order.status
									})]
								})]
							}) }, order.id))
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "space-y-3 lg:col-span-2",
					children: actions.map((action) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: action.to,
						className: "flex items-center gap-3 rounded-xl border border-line bg-card p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "grid size-9 place-items-center rounded-lg bg-primary/10 text-primary",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(action.icon, { className: "size-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-semibold",
									children: action.label
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-xs text-mute",
									children: action.desc
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-4 text-mute" })
						]
					}, action.to))
				})]
			})
		]
	});
}
//#endregion
export { DashboardPage as component };
