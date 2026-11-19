import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  component: OrdersLayout,
});

function OrdersLayout() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  if (path === "/orders" || path === "/orders/") return <Navigate to="/engagement-orders" />;
  return <Outlet />;
}
