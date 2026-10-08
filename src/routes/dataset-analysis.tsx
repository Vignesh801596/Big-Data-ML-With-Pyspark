import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState, num } from "@/components/dashboard-bits";
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

export const Route = createFileRoute("/dataset-analysis")({
  head: () => ({
    meta: [
      { title: "Data Analysis — BigData ML Analytics" },
      { name: "description", content: "Inspect CSV columns, inferred data types, missing values, outliers, statistics, and preview records." },
      { property: "og:title", content: "Data Analysis — BigData ML Analytics" },
      { property: "og:description", content: "Detailed customer dataset profiling and quality analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DatasetAnalysisPage,
});

function DatasetAnalysisPage() {
  const { summary } = useAppState();

  if (!summary) {
    return (
      <>
        <PageHeader title="Data Analysis" description="Detailed insights into your loaded data." />
        <EmptyState
          title="No dataset loaded"
          description="Load a CSV file on the Data Processing page first to see detailed column profiling and data statistics."
          action={{ label: "Go to Data Processing", to: "/data-processing" }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
          title="Data Analysis"
        description={`Detailed profiling of ${summary.fileName} — ${num(summary.rowCount)} rows across ${num(summary.columnCount)} columns.`}
      />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Column profile</CardTitle>
          <CardDescription>
            Inferred types, statistics, missing-value strategy and outlier counts.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Missing</TableHead>
                <TableHead className="text-right">Distinct</TableHead>
                <TableHead className="text-right">Outliers</TableHead>
                <TableHead>Statistics</TableHead>
                <TableHead>Missing handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.columns.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-mono text-xs">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.missing} ({c.missingPct.toFixed(1)}%)
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(c.distinct)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(c.outliers)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.type === "numeric"
                      ? `min ${c.min?.toFixed(2)} · mean ${c.mean?.toFixed(2)} · max ${c.max?.toFixed(2)} · sd ${c.stdDev?.toFixed(2)}`
                      : `most frequent: ${c.topValue ?? "—"}`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.missingStrategy === "none" ? "not required" : c.missingStrategy}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Data preview</CardTitle>
          <CardDescription>First 10 rows as parsed by the engine.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {summary.preview.headers.map((h) => (
                  <TableHead key={h} className="whitespace-nowrap font-mono text-xs">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.preview.rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((v, j) => (
                    <TableCell key={j} className="whitespace-nowrap font-mono text-xs">
                      {v === "" ? <span className="text-muted-foreground">null</span> : v}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
