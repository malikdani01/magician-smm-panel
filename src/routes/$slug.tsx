import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { publicBuy } from "@/lib/seo.functions";

export const Route = createFileRoute("/$slug")({
  loader: async ({ params }) => {
    if (!params.slug.startsWith("buy-")) throw notFound();
    const page = await publicBuy({ data: { slug: params.slug } });
    if (!page) throw notFound();
    throw redirect({ href: page.page.path, statusCode: 301 });
  },
});
