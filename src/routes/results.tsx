import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState, MetricCard, PageHeader, num, pct } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Predictions — BigData ML Analytics" },
      {
        name: "description",
        content:
          "Real accuracy, precision, recall and F1 computed from the trained Random Forest model, with predictions on held-out test records.",
      },
      { property: "og:title", content: "Predictions — BigData ML Analytics" },
      {
        property: "og:description",
        content: "Model metrics, confusion matrix and prediction table from the trained model.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { result } = useAppState();

  if (!result) {
    return (
      <>
        <PageHeader title="Predictions" description="Metrics and predictions from the trained model." />
        <EmptyState
          title="No trained model yet"
          description="Results are computed from a model trained on your own dataset, so there is nothing to show until you run the training step."
          action={{ label: "Go to ML Analysis", to: "/ml-analysis" }}
        />
      </>
    );
  }

  const { evaluation, training, cleaning, summary, predictions, predictionCounts, features } =
    result;

  const importanceData = [...features]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8)
    .map((f) => ({ name: f.name, value: Number((f.importance * 100).toFixed(2)) }));

  const classData = predictionCounts.map((c) => ({
    name: c.label,
    Actual: c.actual,
    Predicted: c.predicted,
  }));

  return (
    <>
      <PageHeader
        title="Predictions"
        description={`Evaluated on ${num(training.testCount)} held-out test records from ${summary.fileName}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Accuracy" value={pct(evaluation.accuracy)} hint="test set" />
        <MetricCard label="Precision" value={pct(evaluation.precision)} hint="weighted" />
        <MetricCard label="Recall" value={pct(evaluation.recall)} hint="weighted" />
        <MetricCard label="F1 Score" value={pct(evaluation.f1)} hint="weighted" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feature importance</CardTitle>
            <CardDescription>Relative contribution of each feature in the forest.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={importanceData} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} unit="%" />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, "Importance"]}
                />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actual vs predicted classes</CardTitle>
            <CardDescription>Test-set distribution per class.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Actual" fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
                  {classData.map((_, i) => (
                    <Cell key={i} />
                  ))}
                </Bar>
                <Bar dataKey="Predicted" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-class metrics</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Support</TableHead>
                  <TableHead className="text-right">Precision</TableHead>
                  <TableHead className="text-right">Recall</TableHead>
                  <TableHead className="text-right">F1</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluation.perClass.map((m) => (
                  <TableRow key={m.label}>
                    <TableCell className="font-mono text-xs">{m.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{num(m.support)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(m.precision)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(m.recall)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(m.f1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confusion matrix</CardTitle>
            <CardDescription>Rows: actual class · Columns: predicted class</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>actual \ predicted</TableHead>
                  {evaluation.perClass.map((m) => (
                    <TableHead key={m.label} className="text-right font-mono text-xs">
                      {m.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluation.confusion.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">
                      {evaluation.perClass[i]?.label}
                    </TableCell>
                    {row.map((v, j) => (
                      <TableCell
                        key={j}
                        className={
                          i === j
                            ? "text-right font-mono tabular-nums text-chart-2"
                            : "text-right font-mono tabular-nums text-muted-foreground"
                        }
                      >
                        {num(v)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Prediction sample</CardTitle>
          <CardDescription>
            First 50 held-out test records with the model's predicted class.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[28rem] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Predicted</TableHead>
                <TableHead className="text-right">Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictions.map((p) => (
                <TableRow key={p.record}>
                  <TableCell className="font-mono text-xs">{p.record}</TableCell>
                  <TableCell className="font-mono text-xs">{p.actual}</TableCell>
                  <TableCell className="font-mono text-xs">{p.predicted}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.correct ? "secondary" : "destructive"}>
                      {p.correct ? "correct" : "incorrect"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dataset summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <Line label="File" value={summary.fileName} />
            <Line label="Rows" value={num(summary.rowCount)} />
            <Line label="Columns" value={num(summary.columnCount)} />
            <Line label="Target column" value={result.target} />
            <Line
              label="Classes"
              value={result.labels.map((l) => `${l.name} (${num(l.count)})`).join(", ")}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processing summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <Line label="Rows before cleaning" value={num(cleaning.rowsBefore)} />
            <Line label="Duplicates removed" value={num(cleaning.duplicatesRemoved)} />
            <Line label="Rows with missing target" value={num(cleaning.rowsWithMissingTarget)} />
            <Line label="Missing values imputed" value={num(cleaning.missingValuesImputed)} />
            <Line label="Outliers flagged (IQR)" value={num(cleaning.outliersFlagged)} />
            <Line label="Rows after cleaning" value={num(cleaning.rowsAfter)} />
            <Line
              label="Dropped columns"
              value={
                cleaning.droppedColumns.length === 0
                  ? "none"
                  : cleaning.droppedColumns.map((d) => `${d.name} (${d.reason})`).join(", ")
              }
            />
            <Line
              label="Model"
              value={`${training.model} · ${training.numTrees} trees · depth ${training.maxDepth}`}
            />
            <Line label="Training records" value={num(training.trainCount)} />
            <Line label="Test records" value={num(training.testCount)} />
            <Line
              label="Scale handling"
              value={training.sampledFrom ? `${num(training.trainCount + training.testCount)} sampled from ${num(training.sampledFrom)}` : "full cleaned dataset"}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide">{label}</span>
      <span className="text-right font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}
