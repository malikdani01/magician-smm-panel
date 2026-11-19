import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/order")({
  component: () => <Navigate to="/engagement-order" />,
});
