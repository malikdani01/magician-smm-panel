import { C as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as RedirectToSignIn, o as Shell, x as useCurrentUserState } from "./shell-0T8RlVPr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/gate-aBQSAPMD.js
var import_jsx_runtime = require_jsx_runtime();
function Authed({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-4 md:grid-cols-3",
		children: Array.from({ length: 3 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-28 animate-pulse rounded-card bg-card" }, i))
	}) });
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RedirectToSignIn, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shell, { children });
}
//#endregion
export { Authed as t };
