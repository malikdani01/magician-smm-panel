import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, S as useRouter, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { C as Heart, D as Bookmark, T as Clock, c as Sparkles, d as Share2, g as MessageCircle, h as Pencil, i as UserPlus, p as Repeat2, w as Eye } from "../_libs/lucide-react.mjs";
import { h as inr, i as PrimaryButton, m as inputClass, r as Panel, t as Field, u as getCatalog, y as placeOrder } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/order-CZPdYoLx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var LOOK = {
	views: {
		label: "Views",
		icon: Eye,
		ink: "#2563eb",
		dot: "#3b82f6",
		gap: 105
	},
	likes: {
		label: "Likes",
		icon: Heart,
		ink: "#e11d48",
		dot: "#22c55e",
		gap: 200
	},
	shares: {
		label: "Shares",
		icon: Share2,
		ink: "#0284c7",
		dot: "#38bdf8",
		gap: 83
	},
	reposts: {
		label: "Reposts",
		icon: Repeat2,
		ink: "#0f766e",
		dot: "#14b8a6",
		gap: 85
	},
	saves: {
		label: "Saves",
		icon: Bookmark,
		ink: "#ea580c",
		dot: "#eab308",
		gap: 480
	},
	comments: {
		label: "Comments",
		icon: MessageCircle,
		ink: "#0f766e",
		dot: "#14b8a6",
		gap: 90
	},
	subscribers: {
		label: "Subscribers",
		icon: UserPlus,
		ink: "#7c3aed",
		dot: "#a855f7",
		gap: 120
	}
};
function lookFor(type) {
	return LOOK[type] ?? {
		label: type,
		icon: Sparkles,
		ink: "#2563eb",
		dot: "#3b82f6",
		gap: 90
	};
}
function defaultPace(type) {
	return {
		gapMin: lookFor(type).gap,
		variance: 20,
		peak: true,
		night: true
	};
}
function runCount(quantity) {
	return Math.max(1, Math.min(80, Math.round(Math.sqrt(Math.max(quantity, 1)) * .5)));
}
function durationLabel(quantity, gapMin) {
	const runs = runCount(quantity);
	const mins = Math.max(gapMin, (runs - 1) * gapMin);
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return {
		runs,
		text: h > 0 ? `~${h}H ${m}M` : `~${m}M`
	};
}
function Switch({ on, disabled, label, soft, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		role: "switch",
		"aria-checked": on,
		"aria-label": label,
		disabled,
		onClick,
		className: `relative h-7 w-12 shrink-0 rounded-full transition ${on ? soft ? "bg-[#d5e4f2]" : "bg-[#3b82f6]" : "bg-[#e8eef6]"}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `absolute top-0.5 size-6 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}` })
	});
}
function EngagementBreakdown({ items, enabled, quantityOf, priceOf, pace, onToggle, onQuantity, onPace }) {
	const [open, setOpen] = (0, import_react.useState)(null);
	const active = items.filter((item) => item.is_base || enabled.includes(item.engagement_type)).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-4 flex items-start justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "text-2xl font-extrabold tracking-tight text-[#0f172a]",
			children: "Engagement Breakdown"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-0.5 text-sm text-slate-500",
			children: "Customize organic settings per type"
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white",
			children: [active, " active"]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "space-y-3",
		children: items.map((item) => {
			const on = item.is_base || enabled.includes(item.engagement_type);
			const look = lookFor(item.engagement_type);
			const Icon = look.icon;
			const qty = quantityOf(item);
			const price = priceOf(item, qty);
			const rowPace = pace[item.engagement_type] ?? defaultPace(item.engagement_type);
			const timing = durationLabel(qty, rowPace.gapMin);
			const expanded = open === item.engagement_type;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: `rounded-2xl border border-[#e6eef8] bg-white shadow-[0_8px_24px_rgba(20,50,90,0.04)] ${on ? "" : "opacity-60"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											className: "size-4 text-slate-400",
											strokeWidth: 1.75
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "grid size-5 place-items-center rounded-md text-[11px]",
											style: {
												background: `${look.dot}22`,
												color: look.ink
											},
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
												className: "size-3.5",
												strokeWidth: 2.4
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[15px] font-extrabold",
											style: { color: look.ink },
											children: look.label
										}),
										item.is_base && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-md bg-[#2563eb] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white",
											children: "BASE"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#334155]",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-3 text-sky-500" }),
										timing.runs,
										" RUNS",
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "font-medium text-slate-300",
											children: "·"
										}),
										timing.text
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-[11px] text-slate-400",
									children: [
										"Min: ",
										item.min_quantity.toLocaleString("en-IN"),
										" · Max: ",
										item.max_quantity.toLocaleString("en-IN")
									]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ml-auto flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									"aria-label": `${look.label} quantity`,
									inputMode: "numeric",
									disabled: !on,
									value: qty,
									onChange: (event) => {
										const next = Number(event.target.value.replace(/\D/g, ""));
										if (!Number.isFinite(next)) return;
										onQuantity(item.engagement_type, next);
									},
									className: "h-10 w-24 rounded-full border border-transparent bg-[#f3f7fb] text-center text-sm font-semibold text-slate-800 outline-none focus:border-[#93c5fd]"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "inline-flex h-10 min-w-20 items-center justify-center rounded-full bg-[#f8fafc] px-3 text-sm font-semibold text-slate-700",
									children: inr(price)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									on,
									disabled: item.is_base,
									label: `${look.label} ${on ? "on" : "off"}`,
									onClick: () => onToggle(item.engagement_type)
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setOpen(expanded ? null : item.engagement_type),
						className: "flex w-full items-center justify-center gap-2 border-t border-[#eef3f8] py-2.5 text-[11px] font-semibold tracking-[0.16em] text-slate-400",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, { className: "size-3.5" }),
							"SETTINGS",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: `transition ${expanded ? "rotate-180" : ""}`,
								children: "▾"
							})
						]
					}),
					expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 border-t border-[#eef3f8] px-5 py-4 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-xs font-semibold text-slate-500",
								children: [
									"Gap between runs · ",
									rowPace.gapMin,
									" min",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "range",
										min: 15,
										max: 480,
										value: rowPace.gapMin,
										onChange: (event) => onPace(item.engagement_type, {
											...rowPace,
											gapMin: Number(event.target.value)
										}),
										className: "mt-2 w-full accent-[#2563eb]"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block text-xs font-semibold text-slate-500",
								children: [
									"Variance · ",
									rowPace.variance,
									"%",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										type: "range",
										min: 0,
										max: 50,
										value: rowPace.variance,
										onChange: (event) => onPace(item.engagement_type, {
											...rowPace,
											variance: Number(event.target.value)
										}),
										className: "mt-2 w-full accent-[#2563eb]"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center justify-between gap-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-slate-700",
								children: ["Peak hours 6–10 PM", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									on: rowPace.peak,
									label: "Peak hours",
									onClick: () => onPace(item.engagement_type, {
										...rowPace,
										peak: !rowPace.peak
									})
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex items-center justify-between gap-3 rounded-xl bg-[#f8fafc] px-3 py-2 text-sm font-semibold text-slate-700",
								children: ["Night slowdown", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
									on: rowPace.night,
									label: "Night slowdown",
									onClick: () => onPace(item.engagement_type, {
										...rowPace,
										night: !rowPace.night
									})
								})]
							})
						]
					})
				]
			}, item.id);
		})
	})] });
}
function GrowthCurve({ series }) {
	const [viewOnly, setViewOnly] = (0, import_react.useState)(true);
	const [points, setPoints] = (0, import_react.useState)([
		.08,
		.16,
		.38,
		.66,
		.86,
		1
	]);
	const [preview, setPreview] = (0, import_react.useState)(false);
	const drag = (0, import_react.useRef)(null);
	const svgRef = (0, import_react.useRef)(null);
	function move(clientY) {
		const svg = svgRef.current;
		const index = drag.current;
		if (!svg || index == null) return;
		const rect = svg.getBoundingClientRect();
		const y = 1 - (clientY - rect.top) / rect.height;
		const next = Math.min(1, Math.max(.02, y));
		setPoints((current) => current.map((value, i) => i === index ? next : value));
	}
	const poly = points.map((y, i) => {
		return `${i / (points.length - 1) * 600},${16 + (1 - y) * 188}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-2xl border border-[#e6eef8] bg-white p-4 shadow-[0_8px_24px_rgba(20,50,90,0.04)] sm:p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-lg font-extrabold text-[#0f172a]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { className: "size-4" }), "Draw Your Growth Curve"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-sm text-slate-500",
					children: ["View Only", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
						on: viewOnly,
						soft: true,
						label: "View only",
						onClick: () => setViewOnly((value) => !value)
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "relative overflow-hidden rounded-xl border border-[#e7f0f8] bg-[linear-gradient(180deg,#f8fbff,#f3f8fd)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
					ref: svgRef,
					viewBox: "0 0 600 220",
					className: "h-52 w-full touch-none",
					onPointerMove: (event) => {
						if (!viewOnly) move(event.clientY);
					},
					onPointerUp: () => {
						drag.current = null;
					},
					onPointerLeave: () => {
						drag.current = null;
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: "24",
						y1: "200",
						x2: "576",
						y2: "28",
						stroke: "#dbe7f3",
						strokeWidth: "10",
						strokeLinecap: "round"
					}), !viewOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", {
						points: poly,
						fill: "none",
						stroke: "#2563eb",
						strokeWidth: "3",
						strokeLinejoin: "round",
						strokeLinecap: "round"
					}), points.map((y, i) => {
						const x = i / (points.length - 1) * 600;
						const py = 16 + (1 - y) * 188;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							cx: x,
							cy: py,
							r: "8",
							fill: "#fff",
							stroke: "#2563eb",
							strokeWidth: "3",
							className: "cursor-grab",
							onPointerDown: (event) => {
								drag.current = i;
								event.currentTarget.setPointerCapture(event.pointerId);
							},
							onPointerMove: (event) => move(event.clientY)
						}, i);
					})] })]
				}), viewOnly && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "pointer-events-none absolute inset-0 grid place-items-center text-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-bold text-slate-800",
						children: "Enable Draw Mode to customize curves"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-slate-400",
						children: "Drag points to shape your growth pattern"
					})] })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#eef3f8] pt-3 text-sm font-semibold text-slate-700",
				children: series.map((row) => {
					const look = lookFor(row.type);
					const Icon = look.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "size-2.5 rounded-full",
								style: { background: look.dot }
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-3.5",
								style: { color: look.ink }
							}),
							row.quantity.toLocaleString("en-IN")
						]
					}, row.type);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setPreview((value) => !value),
					className: "inline-flex items-center gap-2 rounded-full border border-[#e6eef8] bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "size-4" }), preview ? "Hide delivery preview" : "Show delivery preview"]
				})
			}),
			preview && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 overflow-x-auto rounded-2xl border border-[#e6eef8] bg-white p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[520px] text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-[11px] uppercase tracking-wider text-slate-400",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-2 font-semibold",
							children: "Point"
						}), series.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
							className: "py-2 font-semibold",
							children: lookFor(row.type).label
						}, row.type))] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: points.map((y, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-t border-[#f1f5f9]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2 text-slate-500",
							children: index === 0 ? "Start" : index === points.length - 1 ? "Done" : `${Math.round(index / (points.length - 1) * 100)}%`
						}), series.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2 font-semibold text-slate-800",
							children: Math.round(row.quantity * y).toLocaleString("en-IN")
						}, row.type))]
					}, index)) })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-xs text-slate-400",
					children: "Preview only. The curve is not sent to a provider."
				})]
			})
		]
	});
}
var PRESETS = [
	1e4,
	5e4,
	1e5,
	25e4,
	5e5
];
function OrderPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderForm, {}) });
}
function OrderForm() {
	const router = useRouter();
	const [bundles, setBundles] = (0, import_react.useState)([]);
	const [bundleId, setBundleId] = (0, import_react.useState)("");
	const [link, setLink] = (0, import_react.useState)("");
	const [base, setBase] = (0, import_react.useState)(1e4);
	const [enabled, setEnabled] = (0, import_react.useState)([]);
	const [overrides, setOverrides] = (0, import_react.useState)({});
	const [pace, setPace] = (0, import_react.useState)({});
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		getCatalog().then((catalog) => {
			setBundles(catalog.bundles);
			const first = catalog.bundles[0];
			if (first) {
				setBundleId(first.id);
				setEnabled(first.items.map((item) => item.engagement_type));
				setPace(Object.fromEntries(first.items.map((item) => [item.engagement_type, defaultPace(item.engagement_type)])));
			}
		}).catch((err) => setError(err instanceof Error ? err.message : "Catalog failed."));
	}, []);
	const bundle = bundles.find((row) => row.id === bundleId) ?? bundles[0];
	function quantityOf(item) {
		if (item.is_base) return Math.min(item.max_quantity, Math.max(item.min_quantity, base || item.min_quantity));
		if (overrides[item.engagement_type] != null) return Math.min(item.max_quantity, Math.max(item.min_quantity, overrides[item.engagement_type]));
		const raw = Math.round(base * item.ratio_bps / 1e4);
		return Math.min(item.max_quantity, Math.max(item.min_quantity, raw));
	}
	function priceOf(item, quantity) {
		return Math.max(1, Math.round(quantity * item.price_per_1k_paise / 1e3));
	}
	const lines = (0, import_react.useMemo)(() => {
		if (!bundle) return [];
		return bundle.items.filter((item) => item.is_base || enabled.includes(item.engagement_type)).map((item) => {
			const quantity = quantityOf(item);
			return {
				...item,
				quantity,
				price: priceOf(item, quantity)
			};
		});
	}, [
		bundle,
		base,
		enabled,
		overrides
	]);
	const total = lines.reduce((sum, line) => sum + line.price, 0);
	function pickBundle(id) {
		setBundleId(id);
		setOverrides({});
		const next = bundles.find((row) => row.id === id);
		if (next) {
			setEnabled(next.items.map((item) => item.engagement_type));
			setPace(Object.fromEntries(next.items.map((item) => [item.engagement_type, defaultPace(item.engagement_type)])));
		}
	}
	function onQuantity(type, quantity) {
		const item = bundle?.items.find((row) => row.engagement_type === type);
		if (!item) return;
		const next = Math.min(item.max_quantity, Math.max(0, Math.round(quantity)));
		if (item.is_base) {
			setBase(next);
			return;
		}
		setOverrides((current) => ({
			...current,
			[type]: next
		}));
	}
	async function submit() {
		if (!bundle) return;
		setPending(true);
		setError("");
		try {
			const baseLine = lines.find((line) => line.is_base) ?? lines[0];
			const basePace = pace[baseLine?.engagement_type ?? "views"] ?? defaultPace("views");
			const result = await placeOrder({ data: {
				bundleId: bundle.id,
				link,
				baseQuantity: baseLine?.quantity ?? base,
				organic: true,
				intervalHours: Math.min(72, Math.max(1, Math.round(basePace.gapMin / 60))),
				variancePercent: basePace.variance,
				enabledTypes: enabled,
				quantities: Object.fromEntries(lines.map((line) => [line.engagement_type, line.quantity]))
			} });
			await router.navigate({
				to: "/orders/$id",
				params: { id: result.id }
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Order failed.");
		} finally {
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-6 lg:grid-cols-[1.45fr_0.7fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary",
					children: "Full engagement"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-1 text-3xl",
					children: "Build a cue"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-widest text-mute",
						children: "Platform"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: bundles.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => pickBundle(row.id),
							className: "min-h-11 rounded-full px-5 text-xs font-bold uppercase tracking-widest " + (bundle?.id === row.id ? "bg-primary text-primary-fg" : "border border-line bg-card text-mute"),
							children: row.platform
						}, row.id))
					}),
					bundle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-mute",
						children: bundle.tagline
					})
				] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
					className: "space-y-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Post link",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							className: inputClass,
							value: link,
							onChange: (e) => setLink(e.target.value),
							placeholder: "https://"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold text-mute",
						children: "Base views quantity"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: PRESETS.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setBase(value);
								setOverrides({});
							},
							className: "min-h-11 rounded-2xl border px-4 text-sm font-semibold " + (base === value ? "border-primary bg-primary text-primary-fg" : "border-line bg-card"),
							children: value >= 1e3 ? `${value / 1e3}K` : value
						}, value))
					})] })]
				}),
				bundle && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EngagementBreakdown, {
					items: bundle.items,
					enabled,
					quantityOf,
					priceOf,
					pace,
					onToggle: (type) => setEnabled((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]),
					onQuantity,
					onPace: (type, next) => setPace((current) => ({
						...current,
						[type]: next
					}))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GrowthCurve, { series: lines.map((line) => ({
					type: line.engagement_type,
					quantity: line.quantity
				})) })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
			className: "h-fit space-y-4 lg:sticky lg:top-24",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-semibold",
					children: "Order summary"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "space-y-2 text-sm",
					children: lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "capitalize text-mute",
							children: [
								line.engagement_type,
								" · ",
								line.quantity.toLocaleString("en-IN")
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold",
							children: inr(line.price)
						})]
					}, line.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-t border-line pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-mute",
						children: "Total"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-3xl",
						children: inr(total)
					})]
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-destructive",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
					type: "button",
					className: "w-full",
					disabled: pending || !bundle,
					onClick: submit,
					children: pending ? "Placing…" : "Place order"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-mute",
					children: "Held on your ledger. No provider is called."
				})
			]
		})]
	});
}
//#endregion
export { OrderPage as component };
