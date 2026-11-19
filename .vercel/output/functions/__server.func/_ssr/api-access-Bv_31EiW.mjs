import { C as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as Panel } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-access-Bv_31EiW.js
var import_jsx_runtime = require_jsx_runtime();
function ApiPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "max-w-2xl space-y-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold uppercase tracking-widest text-primary",
				children: "API"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-4xl",
				children: "Reseller key"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mute",
				children: "No key is issued. Magiciansmm does not expose an order endpoint and does not call an upstream panel. When you are ready, a provider URL and key can be added here without changing the desk."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 rounded-2xl bg-secondary px-4 py-3 font-mono text-sm text-mute",
				children: "not-connected"
			})] })
		]
	}) });
}
//#endregion
export { ApiPage as component };
