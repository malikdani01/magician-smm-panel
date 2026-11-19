import { C as require_jsx_runtime, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { E as ChartColumn, c as Sparkles, j as Activity, k as ArrowRight, r as Wallet, s as Timer, t as Zap, u as ShieldCheck, x as Layers } from "../_libs/lucide-react.mjs";
import { c as SignedOut, n as Mark, s as SignedIn } from "./shell-0T8RlVPr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CmwdCvNN.js
var import_jsx_runtime = require_jsx_runtime();
var FEATURES = [
	{
		icon: Timer,
		title: "Staged drip",
		body: "Spread a cue across hours with a little jitter, instead of dumping the whole quantity at once."
	},
	{
		icon: Layers,
		title: "Source slots",
		body: "The desk can rotate sources later. Nothing is plugged in, so every cue stays on your ledger."
	},
	{
		icon: Wallet,
		title: "Wallet first",
		body: "Add studio credit, then spend it. No plan gate, and no payment gateway is connected."
	},
	{
		icon: Activity,
		title: "Live desk",
		body: "Balance, queued cues, and recent rows sit on one screen the moment you sign in."
	},
	{
		icon: ShieldCheck,
		title: "No plan gate",
		body: "Create an account and order when the wallet has credit. There is no subscription wall."
	},
	{
		icon: Sparkles,
		title: "Bundle cues",
		body: "Views stay the base. Likes, saves, and shares can ride along at a fixed ratio."
	}
];
var PLATFORMS = [
	"Instagram",
	"TikTok",
	"YouTube",
	"Telegram",
	"Facebook"
];
var ROWS = [
	[
		"Instagram",
		"Reel views",
		"12,500",
		"Running"
	],
	[
		"TikTok",
		"Hearts",
		"4,200",
		"Queued"
	],
	[
		"YouTube",
		"Subscribers",
		"850",
		"Complete"
	],
	[
		"Instagram",
		"Followers",
		"2,000",
		"Running"
	]
];
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "sticky top-0 z-40 border-b border-[#bae6fd] bg-[rgba(224,242,254,0.75)] backdrop-blur-md",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
							className: "hidden items-center gap-8 text-sm text-slate-500 md:flex",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#features",
									className: "hover:text-slate-800",
									children: "Features"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#platforms",
									className: "hover:text-slate-800",
									children: "Platforms"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/support",
									className: "hover:text-slate-800",
									children: "Support"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SignedOut, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/login",
								className: "hidden min-h-10 items-center rounded-lg px-3 text-sm text-slate-500 hover:text-slate-800 sm:inline-flex",
								children: "Sign in"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/login",
								className: "btn-gradient inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold",
								children: ["Get started ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/dashboard",
								className: "btn-gradient inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold",
								children: ["Open desk ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-3.5" })]
							}) })]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "relative",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-5xl px-5 pt-16 text-center sm:px-8 sm:pt-24 pb-16 sm:pb-24",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mb-8 inline-flex items-center gap-2 rounded-full border border-[#93c5fd] bg-[#eff6ff] px-3 py-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "relative flex size-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inline-flex size-full animate-ping rounded-full bg-[#3b82f6] opacity-75" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "relative inline-flex size-2 rounded-full bg-[#2563eb]" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563eb]",
									children: "Magiciansmm · Desk v1"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
								className: "mx-auto mb-6 max-w-4xl text-5xl tracking-tight text-slate-900 sm:text-7xl",
								children: [
									"The growth desk",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									"for ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "serif-em",
										children: "social work."
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mx-auto mb-10 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-xl",
								children: "Paste a link, pick a bundle, and hold the cue on your own ledger. Instagram, TikTok, and YouTube are priced in. No provider is connected."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/login",
									className: "btn-gradient inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold sm:w-auto",
									children: ["Open the desk ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "size-4" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/login",
									className: "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#93c5fd] bg-white/70 px-7 text-sm font-semibold text-slate-700 sm:w-auto",
									children: "Add credit"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-16 border-t border-[#bae6fd] pt-8",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-5 text-[10px] uppercase tracking-[0.24em] text-slate-400",
									children: "Built for the platforms that matter"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-slate-400",
									children: PLATFORMS.map((name) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-semibold uppercase tracking-[0.18em]",
										children: name
									}, name))
								})]
							})
						]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "features",
					className: "border-t border-[#bae6fd] py-20 sm:py-28",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-6xl px-5 sm:px-8",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-14 max-w-2xl",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2563eb]",
								children: "The software"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "text-3xl text-slate-900 sm:text-5xl",
								children: [
									"Built like infrastructure,",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "serif-em",
										children: "used like a product."
									})
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3",
							children: FEATURES.map((feature) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
								className: "rounded-2xl border border-[#bae6fd] bg-white/75 p-6 backdrop-blur",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mb-5 grid size-10 place-items-center rounded-lg border border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(feature.icon, { className: "size-5" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "mb-2 text-base font-semibold text-slate-800",
										children: feature.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm leading-relaxed text-slate-500",
										children: feature.body
									})
								]
							}, feature.title))
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					id: "platforms",
					className: "border-t border-[#bae6fd] py-20",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2563eb]",
								children: "Cross-platform"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "mb-5 text-3xl text-slate-900 sm:text-5xl",
								children: [
									"One desk for",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "serif-em",
										children: "every channel."
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-8 max-w-lg leading-relaxed text-slate-600",
								children: "Drop in a URL, choose a bundle, and launch. Magiciansmm stores the cue, the price, and the pace. Upstream delivery waits until you connect a source."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-3",
								children: [
									"Instagram views, likes, and follows",
									"TikTok views, hearts, and follows",
									"YouTube views and subscribers",
									"Telegram and Facebook lines, priced later"
								].map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-3 text-sm text-slate-700",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "grid size-5 place-items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChartColumn, { className: "size-3" })
									}), line]
								}, line))
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -inset-4 rounded-full bg-[#2563eb]/10 blur-2xl" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative rounded-2xl border border-[#bae6fd] bg-white/85 p-6 shadow-md backdrop-blur",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-5 flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-full bg-red-300" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-full bg-amber-200" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-full bg-emerald-300" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-auto text-[10px] uppercase tracking-[0.18em] text-slate-400",
											children: "magiciansmm"
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "space-y-3",
									children: ROWS.map(([platform, kind, qty, status]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between rounded-lg border border-[#bae6fd] bg-[#f0f9ff] px-3.5 py-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mb-0.5 text-[10px] uppercase tracking-widest text-slate-400",
											children: platform
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm font-medium text-slate-700",
											children: kind
										})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-right",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-sm font-semibold text-slate-800",
												children: qty
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "text-[10px] font-semibold uppercase tracking-wider " + (status === "Complete" ? "text-emerald-500" : status === "Queued" ? "text-amber-500" : "text-blue-500"),
												children: status
											})]
										})]
									}, platform + kind))
								})]
							})]
						})]
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					className: "border-t border-[#bae6fd] py-20",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-4xl px-5 text-center sm:px-8",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "mb-5 text-3xl text-slate-900 sm:text-5xl",
								children: ["Ready to open ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "serif-em",
									children: "the desk?"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mx-auto mb-8 max-w-xl text-slate-600",
								children: "Skip the template panels. Run the ledger like software, then connect a source when you choose."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/login",
								className: "btn-gradient inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-7 text-sm font-semibold",
								children: ["Open the desk ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Zap, { className: "size-4" })]
							})
						]
					})
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-[#bae6fd] py-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-500 sm:flex-row sm:px-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, { compact: true }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							"© ",
							(/* @__PURE__ */ new Date()).getFullYear(),
							" Magiciansmm · v1"
						] })]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/support",
								className: "hover:text-slate-800",
								children: "Support"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/catalog",
								className: "hover:text-slate-800",
								children: "Services"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/login",
								className: "hover:text-slate-800",
								children: "Sign in"
							})
						]
					})]
				})
			})
		]
	});
}
//#endregion
export { Home as component };
