import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as listTickets, i as PrimaryButton, m as inputClass, r as Panel, t as Field, v as openTicket } from "./shell-0T8RlVPr.mjs";
import { t as Authed } from "./gate-aBQSAPMD.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/support-DPtowx1O.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SupportPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Authed, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Support, {}) });
}
function Support() {
	const [subject, setSubject] = (0, import_react.useState)("");
	const [body, setBody] = (0, import_react.useState)("");
	const [rows, setRows] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	function load() {
		listTickets().then(setRows).catch(() => setRows([]));
	}
	(0, import_react.useEffect)(() => {
		load();
	}, []);
	async function submit(event) {
		event.preventDefault();
		setPending(true);
		setError("");
		try {
			await openTicket({ data: {
				subject,
				body
			} });
			setSubject("");
			setBody("");
			load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save the note.");
		} finally {
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-6 lg:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold uppercase tracking-widest text-primary",
				children: "Support"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-1 text-4xl",
				children: "Desk notes"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
				onSubmit: submit,
				className: "mt-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Subject",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: inputClass,
								value: subject,
								onChange: (e) => setSubject(e.target.value)
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Note",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								className: `${inputClass} min-h-32`,
								value: body,
								onChange: (e) => setBody(e.target.value)
							})
						}),
						error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-destructive",
							children: error
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrimaryButton, {
							type: "submit",
							disabled: pending,
							children: pending ? "Saving…" : "Save note"
						})
					]
				})
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-3",
			children: [rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mute",
				children: "No notes yet."
			}), rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Panel, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xl",
				children: row.subject
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-mute",
				children: row.body
			})] }, row.id))]
		})]
	});
}
//#endregion
export { SupportPage as component };
