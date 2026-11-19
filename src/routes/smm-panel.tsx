import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/smm-panel")({
  component: () => <Outlet />,
});
