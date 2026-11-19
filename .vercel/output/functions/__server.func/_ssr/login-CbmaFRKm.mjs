import { o as __toESM } from "../_runtime.mjs";
import { C as require_jsx_runtime, S as useRouter, X as require_react, b as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as signIn, t as authClient } from "./client-1vAx-gM_.mjs";
import { t as GROK_PROVIDERS } from "./server-ZSfi0AtT.mjs";
import { A as ArrowLeft } from "../_libs/lucide-react.mjs";
import { m as inputClass, n as Mark } from "./shell-0T8RlVPr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-CbmaFRKm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const router = useRouter();
	const [mode, setMode] = (0, import_react.useState)("in");
	const [name, setName] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	async function submit(event) {
		event.preventDefault();
		setError("");
		setPending(true);
		try {
			if (mode === "up") {
				const result = await authClient.signUp.email({
					email,
					password,
					name: name || email.split("@")[0] || "Member",
					callbackURL: "/dashboard"
				});
				if (result.error) throw new Error(result.error.message || "Could not create the account.");
			} else {
				const result = await authClient.signIn.email({
					email,
					password,
					callbackURL: "/dashboard"
				});
				if (result.error) throw new Error(result.error.message || "Those details were not accepted.");
			}
			await router.invalidate();
			await router.navigate({ to: "/dashboard" });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign-in failed.");
		} finally {
			setPending(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative min-h-screen px-4 py-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/",
			className: "inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-4" }), " Back to home"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto mt-8 w-full max-w-md",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-6 flex justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl border border-[#bae6fd] bg-white p-6 shadow-[0_14px_40px_rgba(20,50,110,0.08)] md:p-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-3xl text-slate-900",
						children: mode === "in" ? "Welcome back" : "Create your desk"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-slate-500",
						children: mode === "in" ? "Sign in to your dashboard." : "Free account. Add credit when you are ready."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
						onSubmit: submit,
						className: "mt-6 space-y-4",
						children: [
							mode === "up" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold text-mute",
									children: "Name"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "w-full rounded-xl border border-line bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
									value: name,
									onChange: (e) => setName(e.target.value),
									placeholder: "Your name"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold text-mute",
									children: "Email"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: inputClass,
									type: "email",
									required: true,
									autoComplete: "email",
									value: email,
									onChange: (e) => setEmail(e.target.value),
									placeholder: "name@example.com"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block space-y-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center justify-between text-xs font-semibold text-mute",
									children: ["Password", mode === "in" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium text-primary",
										children: "8+ characters"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: inputClass,
									type: "password",
									required: true,
									minLength: 8,
									autoComplete: mode === "up" ? "new-password" : "current-password",
									value: password,
									onChange: (e) => setPassword(e.target.value),
									placeholder: "••••••••"
								})]
							}),
							error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-destructive",
								children: error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								disabled: pending,
								className: "btn-gradient inline-flex min-h-12 w-full items-center justify-center rounded-xl text-sm font-semibold disabled:opacity-50",
								children: pending ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "w-full text-center text-sm text-slate-500",
								onClick: () => {
									setMode(mode === "in" ? "up" : "in");
									setError("");
								},
								children: mode === "in" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Don't have an account? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-primary",
									children: "Sign up"
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Already have a desk? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-primary",
									children: "Sign in"
								})] })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2 border-t border-line pt-4",
								children: GROK_PROVIDERS.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => signIn(provider.providerId, { callbackURL: "/dashboard" }),
									className: "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line bg-card text-sm font-semibold",
									children: ["Continue with ", provider.label]
								}, provider.providerId))
							})
						]
					})
				]
			})]
		})]
	});
}
//#endregion
export { Login as component };
