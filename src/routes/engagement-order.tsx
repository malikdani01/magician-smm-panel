import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { EngagementConsole } from "@/components/engagement-console";

export const Route = createFileRoute("/engagement-order")({
  component: () => (
    <Authed>
      <EngagementConsole />
    </Authed>
  ),
});
