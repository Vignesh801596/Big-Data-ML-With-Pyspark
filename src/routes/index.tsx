import { Link, createFileRoute } from "@tanstack/react-router";
import { BarChart3, Database, Play, Upload, Workflow } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { MetricCard, PageHeader, num, pct } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCsv, toNumber } from "@/lib/ml/csv";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — BigData ML Analytics | PySpark Pipeline" },
      {
        name: "description",
        content:
          "Upload a CSV dataset, run a Spark-style processing pipeline, train a Random Forest classifier and view real accuracy, precision, recall and F1 metrics.",
      },
      { property: "og:title", content: "BigData ML Analytics — Big Data ML with PySpark" },
      {
        property: "og:description",
        content:
          "End-to-end big data pipeline: CSV ingestion, cleaning, feature engineering, Random Forest training and real evaluation metrics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const WORKFLOW_CARDS = [
  {
    step: 1,
    title: "Upload Dataset",
    description: "Load a CSV file and inspect its schema, statistics and preview.",
    icon: Upload,
    to: "/data-processing",
  },
  {
    step: 2,
    title: "Process Data",
    description: "Validate schema, remove duplicates, handle missing values and flag outliers.",
    icon: Database,
    to: "/data-processing",
  },
  {
    step: 3,
    title: "Train Model",
    description: "Assemble feature vectors and fit a Random Forest classifier.",
    icon: Workflow,
    to: "/ml-analysis",
  },
  {
    step: 4,
    title: "View Results",
    description: "Inspect real metrics, the confusion matrix and predictions.",
    icon: BarChart3,
    to: "/results",
  },
] as const;

function Dashboard() {
  const { summary, result, stage, target, csvText, history } = useAppState();

  const statusLabel =
    stage === "empty"
      ? "Awaiting dataset"
      : stage === "loaded"
        ? "Dataset loaded"
        : stage === "cleaned"
          ? "Features prepared"
          : "Model trained";

  const usableFeatures = result?.features.length ?? summary?.columns.filter(
    (column) => column.name !== target && column.distinct > 1 && column.missingPct <= 50,
  ).length;
  const latestPrediction = result?.predictions[0]?.predicted ?? history[0]?.result.predictions[0]?.predicted;
  const customerCharts = buildCustomerCharts(csvText);

  return (
    <>
      <PageHeader
        title="Customer ML Operations"
        description="Live dataset quality, processing, model, and prediction status from the active customer analysis."
      />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <div>
            <Badge variant="outline" className="mb-2">
              {statusLabel}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {summary
                ? `${summary.fileName} — ${num(summary.rowCount)} rows × ${num(summary.columnCount)} columns`
                : "Load a CSV dataset to start the pipeline. A sample dataset is available."}
            </p>
          </div>
          <Button asChild>
            <Link to={result ? "/results" : summary ? "/ml-analysis" : "/data-processing"}>
              <Play className="size-4" />
              {result ? "View Results" : summary ? "Continue Analysis" : "Start Analysis"}
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Dataset"
          value={<span className="text-base">{summary?.fileName ?? "—"}</span>}
          hint={target ? `target: ${target}` : "no target selected"}
        />
        <MetricCard label="Total records" value={summary ? num(summary.rowCount) : "—"} />
        <MetricCard label="Features" value={usableFeatures === undefined ? "—" : num(usableFeatures)} />
        <MetricCard label="Dataset status" value={<span className="text-base">{summary ? "Validated" : "Not loaded"}</span>} />
        <MetricCard
          label="Model status"
          value={<span className="text-base">{result ? "Trained" : stage === "cleaned" ? "Ready" : "Waiting"}</span>}
          hint={result ? `${result.training.model} · ${result.training.numTrees} trees` : "Random Forest classifier"}
        />
        <MetricCard
          label="Latest prediction"
          value={<span className="text-base">{latestPrediction ?? "—"}</span>}
          hint={latestPrediction ? `target: ${result?.target ?? history[0]?.result.target}` : "no predictions yet"}
        />
        <MetricCard label="Processing status" value={<span className="text-base">{statusLabel}</span>} hint={result ? `${pct(result.evaluation.accuracy)} accuracy` : undefined} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {customerCharts.map((chart) => (
          <Card key={chart.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{chart.title}</CardTitle>
              <CardDescription>{chart.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {chart.data.length ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart.data} margin={{ left: -18, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                      />
                      <Bar dataKey="value" name="Records" fill={`var(${chart.color})`} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
                  Load a CSV containing a matching {chart.fieldLabel} field to generate this chart.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Workflow
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WORKFLOW_CARDS.map(({ step, title, description, icon: Icon, to }) => (
          <Card key={step} className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-secondary font-mono text-xs text-secondary-foreground">
                  {step}
                </span>
                <Icon className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="mt-2 text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link to={to}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

type CustomerChart = {
  title: string;
  description: string;
  fieldLabel: string;
  color: "--chart-1" | "--chart-2" | "--chart-3" | "--chart-4";
  data: { name: string; value: number }[];
};

function buildCustomerCharts(csvText: string | null): CustomerChart[] {
  const definitions = [
    { title: "Income distribution", description: "Customer counts across income ranges.", fieldLabel: "income", aliases: ["income", "annual_income", "salary"], color: "--chart-1" as const, numeric: true },
    { title: "Spending score", description: "Distribution of observed spending scores.", fieldLabel: "spending score", aliases: ["spending_score", "spend_score", "spending"], color: "--chart-2" as const, numeric: true },
    { title: "Purchase frequency", description: "Distribution of customer purchase activity.", fieldLabel: "purchase frequency", aliases: ["purchase_frequency", "purchase_count", "frequency", "purchases"], color: "--chart-3" as const, numeric: true },
    { title: "Customer segments", description: "Records grouped by customer segment or pattern.", fieldLabel: "segment", aliases: ["segment", "customer_segment", "cluster", "pattern", "plan"], color: "--chart-4" as const, numeric: false },
  ];
  if (!csvText) return definitions.map((item) => ({ ...item, data: [] }));
  const parsed = parseCsv(csvText);
  const normalized = parsed.headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, "_"));

  return definitions.map((definition) => {
    const index = normalized.findIndex((header) => definition.aliases.some((alias) => header === alias || header.includes(alias)));
    if (index < 0) return { ...definition, data: [] };
    const values = parsed.rows.map((row) => row[index] ?? "").filter(Boolean);
    if (!definition.numeric) return { ...definition, data: categoricalCounts(values) };
    return { ...definition, data: numericBins(values.map(toNumber).filter((value): value is number => value !== null)) };
  });
}

function categoricalCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
}

function numericBins(values: number[]) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ name: min.toLocaleString(), value: values.length }];
  const width = (max - min) / 6;
  const bins = Array.from({ length: 6 }, (_, index) => ({
    name: `${Math.round(min + index * width).toLocaleString()}–${Math.round(min + (index + 1) * width).toLocaleString()}`,
    value: 0,
  }));
  for (const value of values) {
    const index = Math.min(5, Math.floor((value - min) / width));
    const bin = bins[index];
    if (bin) bin.value++;
  }
  return bins;
}
