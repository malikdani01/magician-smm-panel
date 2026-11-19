import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { h as inr, i as PrimaryButton, l as creditWallet, p as getWallet, r as Panel } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wallet-K1hT3Z7u.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var AMOUNTS = [
	5e4,
	1e5,
	25e4,
	5e5
];
function WalletPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletDesk, {}) });
}
function WalletDesk() {
	const [balance, setBalance] = (0, import_react.useState)(null);
	const [rows, setRows] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(0);
	function load() {
		getWallet().then((wallet) => {
			setBalance(wallet.balance_paise);
			setRows(wallet.transactions);
		}).catch((err) => setError(err instanceof Error ? err.message : "Wallet failed."));
	}
	(0, import_react.useEffect)(() => {
		load();
	}, []);
	async function add(amount) {
		setPending(amount);
		setError("");
		try {
			const next = await creditWallet({ data: amount });
			setBalance(next.balance_paise);
			load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Credit failed.");
		} finally {
			setPending(0);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold uppercase tracking-widest text-primary",
				children: "Wallet"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 text-4xl",
				children: "Studio credit"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-semibold uppercase tracking-widest text-mute",
					children: "Available"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 font-display text-5xl",
					children: balance === null ? "…" : inr(balance)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-mute",
					children: "No UPI or card gateway is connected. These buttons only credit the local ledger."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-5 flex flex-wrap gap-2",
					children: AMOUNTS.map((amount) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
						type: "button",
						disabled: pending !== 0,
						onClick: () => add(amount),
						children: pending === amount ? "Adding…" : `Add ${inr(amount)}`
					}, amount))
				}),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm text-destructive",
					children: error
				})
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-2xl",
				children: "Transactions"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
				className: "mt-4 divide-y divide-line",
				children: [rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "py-3 text-sm text-mute",
					children: "No movements yet."
				}), rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-3 py-3 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-semibold capitalize",
						children: row.kind
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-mute",
						children: row.note
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: row.amount_paise < 0 ? "text-destructive" : "text-success",
						children: inr(row.amount_paise)
					})]
				}, row.id))]
			})] })
		]
	});
}
//#endregion
export { WalletPage as component };
