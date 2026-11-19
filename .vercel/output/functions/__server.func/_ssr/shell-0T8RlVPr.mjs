import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react, b as Link, p as useRouterState, x as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { i as signOut, t as authClient } from "./client-1vAx-gM_.mjs";
import { a as hasGateSessionMarker } from "./server-ZSfi0AtT.mjs";
import { t as authMiddleware } from "./middleware-CEd1ujj4.mjs";
import { S as KeyRound, _ as ListPlus, b as LayoutDashboard, c as Sparkles, f as Settings, g as MessageCircle, m as Receipt, n as WandSparkles, r as Wallet, v as LifeBuoy, y as Library } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/shell-0T8RlVPr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	return useSessionUserState();
}
function useSessionUserState() {
	const { data, isPending } = authClient.useSession();
	const id = data?.user.id;
	const displayName = data?.user.name ?? null;
	const primaryEmail = data?.user.email ?? null;
	const profileImageUrl = data?.user.image ?? null;
	const user = (0, import_react.useMemo)(() => id ? {
		id,
		displayName,
		primaryEmail,
		profileImageUrl,
		isDevFallback: false
	} : null, [
		id,
		displayName,
		primaryEmail,
		profileImageUrl
	]);
	return (0, import_react.useMemo)(() => ({
		user,
		isPending
	}), [user, isPending]);
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/**
* Auth state components — plain wrappers around `useCurrentUserState()`.
*
* With auth on, visitors are signed out until they authenticate — in the sandbox
* live preview too, which does real sign-in. The shared dev user appears only
* when auth is disabled (`VITE_AUTH_ENABLED=false`, the shipped default).
* While the session is still resolving, gates that care about signed-out state
* render nothing so there's no signed-out flash on hard reload.
*/
/** Where `RedirectToSignIn` sends signed-out visitors. Create this route. */
var SIGN_IN_PATH = "/login";
/** Render children only when a user is present (real session, or the disabled-auth dev user). */
function SignedIn({ children }) {
	const { user } = useCurrentUserState();
	return user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children }) : null;
}
/**
* Render children only once we KNOW the visitor is signed out (`isPending` has
* cleared and there is no user). Hidden while the session is still loading.
*/
function SignedOut({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending || user) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Client-side redirect to the sign-in route (TanStack `<Navigate>` — NOT a full
* `window.location` reload). A hard navigation re-bootstraps the SPA and re-runs
* session loading, which feels like a second "Loading…" on /login.
*
* Guard routes by waiting out `isPending` first (see `use-current-user`), then
* render this.
*/
function RedirectToSignIn({ to = SIGN_IN_PATH }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var getCatalog = createServerFn({ method: "GET" }).handler(createSsrRpc("4ec21d13fa60565755ae5acb0c886c85e94db0b0cb0b569120fa094138fd85b5"));
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("802d2905e75b9f5bd7272b1b69005ed36294d3a93da20afca364091055ddb7a3"));
var listOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("425c7b4ca8f20880d0302e9883fb473837e5aa38be46b193cf9259229643e6da"));
var getOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => {
	if (typeof id !== "string" || id.length < 8) throw new Error("Missing order.");
	return id;
}).handler(createSsrRpc("689905743bba58c841cddd71186cff995b2f84d19277e97a76db0b2613a3e1e7"));
var getWallet = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("8507b8b1877b689bad2f7200dd2b5c6c424f63a35db7d7d280b5d6866b5139b5"));
var TOPUPS = /* @__PURE__ */ new Set([
	5e4,
	1e5,
	25e4,
	5e5
]);
var creditWallet = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((amountPaise) => {
	const amount = Math.floor(Number(amountPaise));
	if (!TOPUPS.has(amount)) throw new Error("Pick one of the studio credit amounts.");
	return amount;
}).handler(createSsrRpc("fe298e400f147ebc637abd9013a1e42b7d6b8fd56f13b658cc8ef186d3146b40"));
var placeOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const link = String(input?.link ?? "").trim();
	let parsed;
	try {
		parsed = new URL(link);
	} catch {
		throw new Error("Paste a full link, including https://.");
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("The link needs to start with http or https.");
	const baseQuantity = Math.floor(Number(input.baseQuantity));
	if (!Number.isFinite(baseQuantity) || baseQuantity < 100 || baseQuantity > 5e6) throw new Error("Base quantity must be between 100 and 5,000,000.");
	const enabledTypes = Array.isArray(input.enabledTypes) ? input.enabledTypes.filter((type) => typeof type === "string") : [];
	const quantities = {};
	if (input.quantities && typeof input.quantities === "object") for (const [type, value] of Object.entries(input.quantities)) {
		const quantity = Math.floor(Number(value));
		if (Number.isFinite(quantity) && quantity > 0 && quantity <= 5e7) quantities[type] = quantity;
	}
	return {
		bundleId: String(input.bundleId ?? ""),
		link,
		baseQuantity,
		organic: Boolean(input.organic),
		intervalHours: Math.min(72, Math.max(1, Math.floor(Number(input.intervalHours) || 1))),
		variancePercent: Math.min(50, Math.max(0, Math.floor(Number(input.variancePercent) || 0))),
		enabledTypes,
		quantities
	};
}).handler(createSsrRpc("568cbd336ac8c7208a2f719fcddda15fe5ece9f7dbc8489da0b4a37f54f35bf5"));
var simulateDelivery = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => {
	if (typeof id !== "string" || id.length < 8) throw new Error("Missing order.");
	return id;
}).handler(createSsrRpc("c2dccedbed6acbda54546c95947b7f40edd841c845ac4fbe771544e934873d72"));
var listTickets = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("53f8f7504e89ee6fcf5370296775e69d457b024b7850f178d85275d77c13d752"));
var openTicket = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const subject = String(input?.subject ?? "").trim().slice(0, 120);
	const body = String(input?.body ?? "").trim().slice(0, 2e3);
	if (subject.length < 3 || body.length < 8) throw new Error("Write a subject and a short note.");
	return {
		subject,
		body
	};
}).handler(createSsrRpc("eca33ce65d3c798ea431e095459370949a483f7098b8c9cbfa0c02e1b94b2432"));
function inr(paise) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2
	}).format((paise || 0) / 100);
}
var LINKS = [
	{
		to: "/dashboard",
		label: "Dashboard",
		icon: LayoutDashboard,
		hot: false
	},
	{
		to: "/order",
		label: "Full engagement",
		icon: WandSparkles,
		hot: true
	},
	{
		to: "/mass",
		label: "Mass order",
		icon: ListPlus,
		hot: true
	},
	{
		to: "/orders",
		label: "Orders",
		icon: Receipt,
		hot: false
	},
	{
		to: "/catalog",
		label: "Services",
		icon: Library,
		hot: false
	},
	{
		to: "/wallet",
		label: "Wallet",
		icon: Wallet,
		hot: false
	},
	{
		to: "/api-access",
		label: "API access",
		icon: KeyRound,
		hot: false
	},
	{
		to: "/support",
		label: "Support",
		icon: LifeBuoy,
		hot: false
	},
	{
		to: "/settings",
		label: "Settings",
		icon: Settings,
		hot: false
	}
];
function Mark({ compact = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/",
		className: "flex items-center gap-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "grid size-9 place-items-center rounded-xl bg-[#2563eb] text-white ring-1 ring-[#93c5fd]",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "size-4" })
		}), !compact && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex flex-col leading-tight",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[15px] font-bold tracking-tight text-foreground",
				children: "Magiciansmm"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[9px] font-semibold uppercase tracking-[0.18em] text-primary/70",
				children: "Desk v1"
			})]
		})]
	});
}
function Shell({ children }) {
	const path = useRouterState({ select: (state) => state.location.pathname });
	const { user, isPending } = useCurrentUserState();
	const [balance, setBalance] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		getWallet().then((wallet) => setBalance(wallet.balance_paise)).catch(() => setBalance(null));
	}, [path]);
	const initial = (user?.displayName || user?.primaryEmail || "M").slice(0, 1).toUpperCase();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen md:grid md:grid-cols-[260px_1fr]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "sticky top-0 hidden h-screen flex-col border-r border-line bg-card/95 backdrop-blur-xl md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center justify-between px-5 pb-3 pt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-4 mb-3 flex items-center gap-2.5 rounded-xl border border-line bg-secondary px-3 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-[11px] font-bold text-white",
							children: initial
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-[12px] font-semibold",
								children: user?.displayName || "Member"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-[10px] text-mute",
								children: user?.primaryEmail || "Signed in"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mx-4 mb-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-primary/10 to-primary/5 p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-primary/80",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "size-3" }), " Wallet balance"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-3 text-[22px] font-extrabold tracking-tight",
									children: balance == null ? "—" : inr(balance)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/wallet",
									className: "flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-primary text-[11px] font-semibold text-primary-fg",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wallet, { className: "size-3" }), " Add credit"]
								})
							]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "flex-1 overflow-y-auto px-3 pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-mute",
							children: "Menu"
						}), LINKS.map((link) => {
							const active = path === link.to || link.to !== "/dashboard" && path.startsWith(`${link.to}/`);
							const Icon = link.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: link.to,
								className: "mb-0.5 flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-[13px] " + (active ? "border-primary/20 bg-primary/10 font-semibold text-primary" : "border-transparent text-mute hover:bg-muted hover:text-foreground"),
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex-1",
										children: link.label
									}),
									link.hot && !active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full border border-primary/25 bg-primary/15 px-1.5 py-0.5 text-[8px] font-bold text-primary",
										children: "HOT"
									})
								]
							}, link.to);
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-3 pb-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between rounded-xl border border-line bg-secondary px-3 py-2 text-[12px] font-medium",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "uppercase tracking-wider",
								children: "INR"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] text-mute",
								children: "₹"
							})]
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 pb-20 md:pb-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-20 flex items-center justify-between border-b border-line/80 bg-background/80 px-4 py-3 backdrop-blur md:px-8",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "md:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "hidden text-sm text-mute md:block",
							children: "Studio ledger · sources not connected"
						}),
						isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-8 animate-pulse rounded-full bg-secondary" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8",
					children
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/support",
				className: "fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-fg shadow-2xl md:bottom-6",
				"aria-label": "Support",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-6" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card/95 backdrop-blur md:hidden",
				children: LINKS.slice(0, 5).map((link) => {
					const active = path === link.to || link.to !== "/dashboard" && path.startsWith(`${link.to}/`);
					const Icon = link.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: link.to,
						className: "flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium " + (active ? "text-primary" : "text-mute"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }), link.label.split(" ")[0]]
					}, link.to);
				})
			})
		]
	});
}
function Panel({ children, className = "" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
		className: `glass-card p-5 ${className}`,
		children
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: "block space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs font-semibold tracking-wide text-mute",
			children: label
		}), children]
	});
}
var inputClass = "w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
function PrimaryButton({ children, className = "", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		...props,
		className: "btn-gradient inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold disabled:opacity-50 " + className,
		children
	});
}
//#endregion
export { listTickets as _, RedirectToSignIn as a, simulateDelivery as b, SignedOut as c, getDashboard as d, getOrder as f, listOrders as g, inr as h, PrimaryButton as i, creditWallet as l, inputClass as m, Mark as n, Shell as o, getWallet as p, Panel as r, SignedIn as s, Field as t, getCatalog as u, openTicket as v, useCurrentUserState as x, placeOrder as y };
