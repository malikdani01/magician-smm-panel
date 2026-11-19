import { createFileRoute } from "@tanstack/react-router";
import { Authed } from "@/components/gate";
import { Panel } from "@/components/shell";

export const Route = createFileRoute("/api-access")({ component: ApiPage });

function ApiPage() {
  return (
    <Authed>
      <div className="max-w-2xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">API</p>
        <h1 className="text-4xl">Reseller key</h1>
        <Panel>
          <p className="text-sm text-mute">
            No key is issued. Magiciansmm does not expose an order endpoint and does not call an upstream panel.
            When you are ready, a provider URL and key can be added here without changing the desk.
          </p>
          <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 font-mono text-sm text-mute">not-connected</p>
        </Panel>
      </div>
    </Authed>
  );
}
