import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { publicSeoMeta } from "@/lib/seo.functions";
import appCss from "../styles.css?url";

const APP_NAME = "Magiciansmm";
const PRIVATE = ["/admin", "/dashboard", "/wallet", "/orders", "/order", "/settings", "/login", "/api", "/engagement-order", "/engagement-orders", "/single-order", "/mass", "/detect", "/instagram", "/tiktok", "/telegram-bot", "/support", "/appeal", "/api-access"];

function isPrivate(pathname: string) {
  const path = pathname.split("?")[0] || "/";
  return PRIVATE.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function PwaInstall() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export const Route = createRootRoute({
  loader: async () => {
    try {
      return await publicSeoMeta();
    } catch {
      return null;
    }
  },
  head: ({ loaderData, matches }) => {
    const path = matches[matches.length - 1]?.pathname || "/";
    const seo = loaderData;
    const ownTitle = path === "/" || path.startsWith("/smm-panel") || path.startsWith("/buy-");
    const hide = seo?.flags.hidePrivate !== false && isPrivate(path);
    const tagsOn = seo?.flags.seoTags !== false;
    const title = seo?.title || `${seo?.panelName || APP_NAME} — Growth desk`;
    const description = seo?.description || "Magiciansmm is a wallet-based growth desk for staged social cues. Orders stay on your ledger until a provider is connected.";
    const meta = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#16072F" },
      { name: "application-name", content: "Magician SMM" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Magician SMM" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      ...(ownTitle ? [] : [{ title }, { name: "description", content: description }]),
      ...(hide ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ...(tagsOn && seo?.googleCode ? [{ name: "google-site-verification", content: seo.googleCode }] : []),
      ...(tagsOn && seo?.bingCode ? [{ name: "msvalidate.01", content: seo.bingCode }] : []),
    ];
    const scripts = [];
    if (tagsOn && !hide && seo?.gaId) {
      scripts.push({ src: `https://www.googletagmanager.com/gtag/js?id=${seo.gaId}`, async: true });
      scripts.push({ children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seo.gaId}');` });
    }
    if (tagsOn && !hide && seo?.gtmId) {
      scripts.push({ children: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${seo.gtmId}');` });
    }
    return {
      meta,
      links: [
        { rel: "icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/assets/icons/favicon-16x16.png" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/assets/icons/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "48x48", href: "/assets/icons/favicon-48x48.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/assets/icons/apple-touch-icon.png" },
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700;1,800&display=swap",
        },
        { rel: "manifest", href: "/manifest.webmanifest" },
      ],
      scripts,
    };
  },
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <PwaInstall />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
