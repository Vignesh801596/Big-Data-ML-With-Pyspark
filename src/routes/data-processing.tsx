import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { MetricCard, PageHeader, PipelineSteps, num } from "@/components/dashboard-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inspectDataset } from "@/lib/analysis.functions";
import { markCleaned, setDataset, setTarget, useAppState } from "@/lib/store";

export const Route = createFileRoute("/data-processing")({
  head: () => ({
    meta: [
      { title: "Data Processing — BigData ML Analytics" },
      {
        name: "description",
        content:
          "Upload a CSV dataset and run schema validation, missing-value handling, duplicate removal and outlier checks before machine learning.",
      },
      { property: "og:title", content: "Data Processing — BigData ML Analytics" },
      {
        property: "og:description",
        content: "CSV ingestion with schema validation, cleaning and feature preparation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataProcessingPage,
});

const MAX_FILE_BYTES = 12_000_000;

function DataProcessingPage() {
  const state = useAppState();
  const navigate = useNavigate();
  const inspect = useServerFn(inspectDataset);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = useRef(false);
  async function ingest(fileName: string, csvText: string) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await inspect({ data: { fileName, csvText } });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setDataset(fileName, csvText, res.summary);
      toast.success(`Loaded ${fileName} — ${num(res.summary.rowCount)} rows`);
    } catch {
      setError("The dataset could not be processed. Please try a different CSV file.");
      toast.error("Processing failed.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function onFile(file: File) {
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      setError("Invalid file type. Please upload a .csv file.");
      return;
    }
    if (file.size === 0) {
      setError("This file is empty.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("File is larger than 12 MB. Please upload a smaller CSV.");
      return;
    }
    await ingest(file.name, await file.text());
  }

  async function loadSample() {
    setLoading(true);
    try {
      const res = await fetch("/sample_customer_churn.csv");
      const text = await res.text();
      await ingest("sample_customer_churn.csv", text);
    } catch {
      setError("The sample dataset could not be loaded.");
      setLoading(false);
    }
  }

  const summary = state.summary;

  return (
    <>
      <PageHeader
        title="Dataset Upload"
        description="Upload customer records, validate their schema, and prepare features for the ML pipeline."
      />

      <PipelineSteps
        steps={[
          { label: "Dataset Loaded", state: summary ? "done" : loading ? "active" : "pending" },
          {
            label: "Schema Validated",
            state: summary ? (summary.validation.passed ? "done" : "active") : "pending",
            detail: summary
              ? `${summary.validation.errors} error(s), ${summary.validation.warnings} warning(s)`
              : undefined,
          },
          {
            label: "Data Cleaned",
            state: state.stage === "cleaned" || state.stage === "trained" ? "done" : "pending",
          },
          {
            label: "Ready for ML",
            state: state.stage === "cleaned" || state.stage === "trained" ? "done" : "pending",
          },
        ]}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">1. Upload dataset</CardTitle>
          <CardDescription>CSV files up to 12 MB with a header row; suitable for thousands of customer records.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <div
            className={`flex min-h-44 flex-col items-center justify-center border border-dashed p-6 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border bg-muted/20"
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void onFile(file);
            }}
          >
            {loading ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : (
              <FileSpreadsheet className="size-8 text-muted-foreground" />
            )}
            <p className="mt-3 text-sm font-medium text-foreground">
              {loading ? "Profiling dataset…" : "Drop a customer CSV here"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Schema, missing values, statistics, and outliers are checked automatically.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button onClick={() => fileInput.current?.click()} disabled={loading}>
                <Upload className="size-4" />
                Choose CSV
              </Button>
              <Button variant="outline" onClick={() => void loadSample()} disabled={loading}>
                Load sample
              </Button>
            </div>
            {state.fileName ? (
              <span className="mt-3 font-mono text-xs text-muted-foreground">{state.fileName}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Dataset" value={<span className="text-base">{summary.fileName}</span>} />
            <MetricCard label="Rows" value={num(summary.rowCount)} />
            <MetricCard label="Columns" value={num(summary.columnCount)} />
            <MetricCard
              label="Missing values"
              value={num(summary.validation.totalMissing)}
              hint={`${num(summary.validation.totalOutliers)} outliers flagged`}
            />
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">2. Schema validation</CardTitle>
              <CardDescription>
                Column types, duplicate headers, malformed rows, missing values and IQR outlier
                checks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant={summary.validation.passed ? "secondary" : "destructive"}>
                  {summary.validation.passed ? "Validation passed" : "Validation failed"}
                </Badge>
                <Badge variant="outline">{summary.validation.errors} errors</Badge>
                <Badge variant="outline">{summary.validation.warnings} warnings</Badge>
              </div>
              {summary.validation.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No schema issues detected — every column is well formed and complete.
                </p>
              ) : (
                <ul className="space-y-2">
                  {summary.validation.issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {issue.level === "error" ? (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                      ) : issue.level === "warning" ? (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-chart-5" />
                      ) : (
                        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-muted-foreground">
                        {issue.column ? (
                          <span className="font-mono text-foreground">{issue.column}: </span>
                        ) : null}
                        {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">3. Column profile</CardTitle>
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

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">4. Data preview</CardTitle>
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

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">5. Target column &amp; feature preparation</CardTitle>
              <CardDescription>
                Choose the column the model should predict. Remaining usable columns become the
                feature vector.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              {summary.targetCandidates.length === 0 ? (
                <p className="text-sm text-destructive">
                  No column in this dataset is suitable as a classification target (each needs
                  between 2 and 40 distinct values).
                </p>
              ) : (
                <>
                  <Select value={state.target ?? ""} onValueChange={setTarget}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Select target column" />
                    </SelectTrigger>
                    <SelectContent>
                      {summary.targetCandidates.map((c) => (
                        <SelectItem key={c.name} value={c.name}>
                          {c.name} ({c.distinct} classes)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    disabled={!state.target || !summary.validation.passed}
                    onClick={() => {
                      markCleaned();
                      void navigate({ to: "/ml-analysis" });
                    }}
                  >
                    <CheckCircle2 className="size-4" />
                    Prepare features &amp; continue
                  </Button>
                  {!summary.validation.passed ? (
                    <span className="text-xs text-destructive">
                      Fix the validation errors above before continuing.
                    </span>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </>
  );
}
