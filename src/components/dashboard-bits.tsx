import { Link } from "@tanstack/react-router";
import { Check, CircleDashed, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string | undefined;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export type StepState = "done" | "active" | "pending";

export function PipelineSteps({
  steps,
}: {
  steps: { label: string; state: StepState; detail?: string | undefined }[];
}) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s) => (
        <li
          key={s.label}
          className={cn(
            "rounded-md border p-3",
            s.state === "done" && "border-chart-2/40 bg-chart-2/5",
            s.state === "active" && "border-primary/50 bg-primary/5",
            s.state === "pending" && "border-border bg-card",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            {s.state === "done" ? (
              <Check className="size-4 text-chart-2" />
            ) : s.state === "active" ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <CircleDashed className="size-4 text-muted-foreground" />
            )}
            {s.label}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.detail ?? statusText(s.state)}</p>
        </li>
      ))}
    </ol>
  );
}

function statusText(state: StepState) {
  return state === "done" ? "Completed" : state === "active" ? "In progress" : "Pending";
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; to: "/" | "/data-processing" | "/dataset-analysis" | "/ml-analysis" | "/results" | "/history" };
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-10">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        {action ? (
          <Button asChild size="sm">
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

export function num(value: number) {
  return value.toLocaleString("en-US");
}
