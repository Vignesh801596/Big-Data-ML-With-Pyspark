import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  EmptyState,
  MetricCard,
  PageHeader,
  PipelineSteps,
  num,
  pct,
} from "@/components/dashboard-bits";
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
import { analyzeDataset } from "@/lib/analysis.functions";
import { setResult, setTarget, useAppState } from "@/lib/store";

export const Route = createFileRoute("/ml-analysis")({
  head: () => ({
    meta: [
      { title: "ML Analysis — BigData ML Analytics" },
      {
        name: "description",
        content:
          "Train a Random Forest classifier on the prepared feature vectors with a stratified 80/20 train-test split and real evaluation metrics.",
      },
      { property: "og:title", content: "ML Analysis — BigData ML Analytics" },
      {
        property: "og:description",
        content: "Feature vectorization, train/test split and Random Forest training.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MlAnalysisPage,
});

function MlAnalysisPage() {
  const state = useAppState();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeDataset);
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state.summary || !state.csvText) {
    return (
      <>
        <PageHeader
          title="ML Model"
          description="Train the MLlib Random Forest classifier on your prepared dataset."
        />
        <EmptyState
          title="No dataset loaded"
          description="Upload a CSV file on the Data Processing page first. The model trains on your real data, so nothing can be shown until a dataset is ingested."
          action={{ label: "Go to Data Processing", to: "/data-processing" }}
        />
      </>
    );
  }

  const summary = state.summary;
  const result = state.result;

  async function train() {
    if (!state.csvText || !state.fileName || !state.target) return;
    setError(null);
    setTraining(true);
    try {
      const res = await analyze({
        data: { fileName: state.fileName, csvText: state.csvText, target: state.target },
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      setResult(res.result);
      toast.success(`Model trained — accuracy ${pct(res.result.evaluation.accuracy)}`);
      void navigate({ to: "/results" });
    } catch {
      setError("Model training failed. Try a different target column or a larger dataset.");
      toast.error("Model training failed.");
    } finally {
      setTraining(false);
    }
  }

  const usable = summary.columns.filter(
    (c) => c.name !== state.target && c.distinct > 1 && c.missingPct <= 50,
  );

  return (
    <>
      <PageHeader
        title="ML Model"
        description="Feature vectorization, train/test split, and Random Forest training on your dataset."
      />

      <PipelineSteps
        steps={[
          { label: "Features Prepared", state: "done", detail: `${usable.length} candidate columns` },
          { label: "Train/Test Split", state: result ? "done" : "pending", detail: "80% / 20% stratified" },
          {
            label: "Model Training",
            state: result ? "done" : training ? "active" : "pending",
            detail: result ? `${result.training.trainingTimeMs} ms` : undefined,
          },
          {
            label: "Evaluation",
            state: result ? "done" : "pending",
            detail: result ? `accuracy ${pct(result.evaluation.accuracy)}` : undefined,
          },
        ]}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Model configuration</CardTitle>
            <CardDescription>A single classifier keeps the pipeline reliable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Algorithm" value="RandomForestClassifier" />
            <Row label="Library" value="Spark MLlib equivalent" />
            <Row label="Trees" value={String(result?.training.numTrees ?? 40)} />
            <Row label="Max depth" value={String(result?.training.maxDepth ?? 8)} />
            <Row label="Impurity" value="gini" />
            <Row label="Split" value="80% train / 20% test (stratified, seed 42)" />
            <div className="pt-1">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Target column
              </p>
              <Select value={state.target ?? ""} onValueChange={setTarget}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  {summary.targetCandidates.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name} ({c.distinct} classes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={training || !state.target}
              onClick={() => void train()}
            >
              {training ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {training ? "Training…" : "Train & Analyze"}
            </Button>
            {error ? (
              <p className="flex items-start gap-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Feature vector</CardTitle>
            <CardDescription>
              Numeric columns pass through; text columns are converted with a string indexer.
              Importances appear after training.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Encoding</TableHead>
                  <TableHead className="text-right">Missing</TableHead>
                  <TableHead className="text-right">Importance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(result ? result.features : usable.map((c) => ({
                  name: c.name,
                  kind: c.type === "numeric" ? ("numeric" as const) : ("indexed" as const),
                  importance: -1,
                }))).map((f) => {
                  const col = summary.columns.find((c) => c.name === f.name);
                  return (
                    <TableRow key={f.name}>
                      <TableCell className="font-mono text-xs">{f.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {f.kind === "numeric" ? "numeric" : "StringIndexer"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{col?.missing ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.importance < 0 ? "—" : pct(f.importance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {result ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Training records" value={num(result.training.trainCount)} />
          <MetricCard label="Testing records" value={num(result.training.testCount)} />
          <MetricCard label="Classes" value={num(result.labels.length)} />
          <MetricCard
            label="Training time"
            value={`${result.training.trainingTimeMs} ms`}
            hint={
              result.training.sampledFrom
                ? `sampled from ${num(result.training.sampledFrom)} rows`
                : "full dataset"
            }
          />
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}
