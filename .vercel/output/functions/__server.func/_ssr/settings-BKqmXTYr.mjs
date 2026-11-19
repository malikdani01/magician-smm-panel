import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as signOut } from "./client-1vAx-gM_.mjs";
import { r as Panel, x as useCurrentUserState } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-BKqmXTYr.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SettingsPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {}) });
}
function Settings() {
	const { user } = useCurrentUserState();
	const [pending, setPending] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-xl space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] font-semibold uppercase tracking-[0.18em] text-primary",
				children: "Account"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 font-display text-4xl italic",
				children: "Settings"
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
				className: "space-y-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold uppercase tracking-wider text-mute",
						children: "Profile"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-lg font-semibold",
						children: user?.displayName || "Member"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-mute",
						children: user?.primaryEmail || "No email on file"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: pending,
						onClick: () => {
							setPending(true);
							signOut("/").catch(() => setPending(false));
						},
						className: "inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold",
						children: pending ? "Signing out…" : "Sign out"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Panel, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mute",
				children: "Sources, bots, and reseller keys are not connected. Orders stay on this ledger."
			}) })
		]
	});
}
//#endregion
export { SettingsPage as component };
