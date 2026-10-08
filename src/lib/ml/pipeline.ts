// Spark-style DataFrame pipeline executed on the server:
// load -> schema inference -> cleaning -> StringIndexer/VectorAssembler ->
// randomSplit -> RandomForestClassifier -> transform -> evaluate.

import { isMissing, parseCsv, toNumber } from "./csv";
import { evaluate, type EvaluationResult } from "./metrics";
import { makeRng, predictForest, trainForest } from "./random-forest";

export const MAX_TRAINING_ROWS = 20000;

export type MissingStrategy = "none" | "mean-imputation" | "mode-imputation" | "drop-column";

export type ColumnProfile = {
  name: string;
  type: "numeric" | "categorical";
  missing: number;
  missingPct: number;
  invalidTypeCount: number;
  distinct: number;
  outliers: number;
  missingStrategy: MissingStrategy;
  outlierBounds?: { lower: number; upper: number } | undefined;
  min?: number | undefined;
  max?: number | undefined;
  mean?: number | undefined;
  stdDev?: number | undefined;
  q1?: number | undefined;
  q3?: number | undefined;
  topValue?: string | undefined;
};

export type ValidationIssue = {
  level: "error" | "warning" | "info";
  column?: string | undefined;
  message: string;
};

export type SchemaValidation = {
  passed: boolean;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
  totalOutliers: number;
  totalMissing: number;
};

export type DatasetSummary = {
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  preview: { headers: string[]; rows: string[][] };
  targetCandidates: { name: string; distinct: number }[];
  suggestedTarget: string | null;
  validation: SchemaValidation;
};

export type CleaningReport = {
  rowsBefore: number;
  duplicatesRemoved: number;
  rowsWithMissingTarget: number;
  rowsAfter: number;
  missingValuesImputed: number;
  outliersFlagged: number;
  droppedColumns: { name: string; reason: string }[];
};

export type FeatureInfo = {
  name: string;
  kind: "numeric" | "indexed";
  importance: number;
};

export type PredictionRow = {
  record: number;
  actual: string;
  predicted: string;
  correct: boolean;
};

export type AnalysisResult = {
  summary: DatasetSummary;
  target: string;
  cleaning: CleaningReport;
  features: FeatureInfo[];
  labels: { name: string; count: number }[];
  training: {
    model: string;
    numTrees: number;
    maxDepth: number;
    trainCount: number;
    testCount: number;
    sampledFrom: number | null;
    trainingTimeMs: number;
  };
  evaluation: EvaluationResult;
  predictions: PredictionRow[];
  predictionCounts: { label: string; predicted: number; actual: number }[];
};

export class PipelineError extends Error {}

const MAX_CATEGORY_CARDINALITY = 40;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

function profileColumn(name: string, values: string[]): ColumnProfile {
  let missing = 0;
  const present: string[] = [];
  for (const v of values) {
    if (isMissing(v)) missing++;
    else present.push(v);
  }
  const distinct = new Set(present).size;
  const numbers = present.map(toNumber);
  const numericCount = numbers.filter((n) => n !== null).length;
  const isNumeric = present.length > 0 && numericCount / present.length >= 0.9 && distinct > 2;
  const total = values.length || 1;
  const missingPct = (missing / total) * 100;
  const invalidTypeCount = isNumeric ? present.length - numericCount : 0;

  if (isNumeric) {
    const nums = numbers.filter((n): n is number => n !== null);
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = nums.length ? sum / nums.length : 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const outliers = iqr === 0 ? 0 : nums.filter((n) => n < lower || n > upper).length;
    const variance = nums.length
      ? nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length
      : 0;
    return {
      name,
      type: "numeric",
      missing,
      missingPct,
      invalidTypeCount,
      distinct,
      min: nums.length ? Math.min(...nums) : undefined,
      max: nums.length ? Math.max(...nums) : undefined,
      mean: nums.length ? mean : undefined,
      stdDev: nums.length ? Math.sqrt(variance) : undefined,
      q1,
      q3,
      outliers,
      outlierBounds: { lower, upper },
      missingStrategy: missing === 0 ? "none" : missingPct > 50 ? "drop-column" : "mean-imputation",
    };
  }

  const freq = new Map<string, number>();
  for (const v of present) freq.set(v, (freq.get(v) ?? 0) + 1);
  let topValue: string | undefined;
  let topCount = -1;
  for (const [v, c] of freq) {
    if (c > topCount) {
      topCount = c;
      topValue = v;
    }
  }
  return {
    name,
    type: "categorical",
    missing,
    missingPct,
    invalidTypeCount: 0,
    distinct,
    topValue,
    outliers: 0,
    missingStrategy: missing === 0 ? "none" : missingPct > 50 ? "drop-column" : "mode-imputation",
  };
}

function validateSchema(
  columns: ColumnProfile[],
  rowCount: number,
  raggedRows: number,
): SchemaValidation {
  const issues: ValidationIssue[] = [];

  const nameCount = new Map<string, number>();
  for (const c of columns) nameCount.set(c.name, (nameCount.get(c.name) ?? 0) + 1);
  for (const [name, count] of nameCount) {
    if (count > 1) {
      issues.push({
        level: "error",
        column: name,
        message: `Duplicate column name appears ${count} times.`,
      });
    }
  }

  if (raggedRows > 0) {
    issues.push({
      level: "warning",
      message: `${raggedRows} row(s) had a different field count than the header and were padded or trimmed.`,
    });
  }

  if (rowCount < 20) {
    issues.push({
      level: "error",
      message: `Validation failed: Only ${rowCount} data rows found. At least 20 rows are required for training and evaluation.`,
    });
  }

  for (const c of columns) {
    if (c.missingPct > 50) {
      issues.push({
        level: "warning",
        column: c.name,
        message: `${c.missingPct.toFixed(1)}% missing — column will be dropped.`,
      });
    } else if (c.missing > 0) {
      issues.push({
        level: "info",
        column: c.name,
        message: `${c.missing} missing value(s) — will be filled using ${
          c.missingStrategy === "mean-imputation" ? "column mean" : "most frequent value"
        }.`,
      });
    }
    if (c.invalidTypeCount > 0) {
      issues.push({
        level: "warning",
        column: c.name,
        message: `${c.invalidTypeCount} value(s) are not valid numbers in a numeric column — treated as missing.`,
      });
    }
    if (c.outliers > 0) {
      issues.push({
        level: "info",
        column: c.name,
        message: `${c.outliers} outlier(s) detected by the IQR rule (outside ${c.outlierBounds!.lower.toFixed(2)} – ${c.outlierBounds!.upper.toFixed(2)}).`,
      });
    }
    if (c.distinct <= 1) {
      issues.push({
        level: "warning",
        column: c.name,
        message: "Constant column — no predictive value, will be dropped.",
      });
    }
  }

  return {
    passed: !issues.some((i) => i.level === "error"),
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning").length,
    issues,
    totalOutliers: columns.reduce((a, c) => a + c.outliers, 0),
    totalMissing: columns.reduce((a, c) => a + c.missing, 0),
  };
}

export function summarize(fileName: string, csvText: string): DatasetSummary {
  const { headers, rows, raggedRows } = parseCsv(csvText);
  if (headers.length === 0) throw new PipelineError("The file appears to be empty.");
  if (rows.length === 0) throw new PipelineError("The file contains headers but no data rows.");
  if (headers.length < 2) {
    throw new PipelineError("At least two columns are required (features and a target column).");
  }

  const columns = headers.map((h, i) =>
    profileColumn(
      h,
      rows.map((r) => r[i] ?? ""),
    ),
  );

  const targetCandidates = columns
    .filter((c) => c.distinct >= 2 && c.distinct <= MAX_CATEGORY_CARDINALITY)
    .map((c) => ({ name: c.name, distinct: c.distinct }));

  const suggested =
    [...targetCandidates].sort((a, b) => {
      const ai = headers.indexOf(a.name);
      const bi = headers.indexOf(b.name);
      const score = (d: number) => (d <= 10 ? 0 : 1);
      return score(a.distinct) - score(b.distinct) || bi - ai;
    })[0]?.name ?? null;

  return {
    fileName,
    rowCount: rows.length,
    columnCount: headers.length,
    columns,
    preview: { headers, rows: rows.slice(0, 10) },
    targetCandidates,
    suggestedTarget: suggested,
    validation: validateSchema(columns, rows.length, raggedRows),
  };
}

export function runPipeline(fileName: string, csvText: string, target: string): AnalysisResult {
  const summary = summarize(fileName, csvText);
  const { headers, rows } = parseCsv(csvText);

  const targetIdx = headers.indexOf(target);
  if (targetIdx < 0) throw new PipelineError(`Target column "${target}" was not found.`);

  const targetProfile = summary.columns[targetIdx]!;
  if (targetProfile.distinct < 2) {
    throw new PipelineError(
      `Target column "${target}" has only one distinct value, so classification is not possible.`,
    );
  }
  if (targetProfile.distinct > MAX_CATEGORY_CARDINALITY) {
    throw new PipelineError(
      `Target column "${target}" has ${targetProfile.distinct} distinct values. Choose a column with at most ${MAX_CATEGORY_CARDINALITY} classes.`,
    );
  }

  // --- distinct() : drop duplicate rows ---
  const seen = new Set<string>();
  const deduped: string[][] = [];
  for (const r of rows) {
    const key = r.join("\u0001");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  const duplicatesRemoved = rows.length - deduped.length;

  // --- na.drop(subset=[target]) ---
  const withTarget = deduped.filter((r) => !isMissing(r[targetIdx] ?? ""));
  const rowsWithMissingTarget = deduped.length - withTarget.length;

  if (withTarget.length < 20) {
    throw new PipelineError(
      `Only ${withTarget.length} usable rows remain after cleaning. At least 20 rows are required to train and evaluate a model.`,
    );
  }

  // --- select useful feature columns ---
  const droppedColumns: { name: string; reason: string }[] = [];
  const featureCols: { index: number; name: string; kind: "numeric" | "indexed" }[] = [];

  summary.columns.forEach((col, i) => {
    if (i === targetIdx) return;
    const missingRatio = col.missing / summary.rowCount;
    if (missingRatio > 0.5) {
      droppedColumns.push({ name: col.name, reason: `${Math.round(missingRatio * 100)}% missing` });
      return;
    }
    if (col.distinct <= 1) {
      droppedColumns.push({ name: col.name, reason: "constant value" });
      return;
    }
    if (col.type === "categorical" && col.distinct > MAX_CATEGORY_CARDINALITY) {
      droppedColumns.push({
        name: col.name,
        reason: `high cardinality (${col.distinct} values)`,
      });
      return;
    }
    if (col.type === "categorical" && col.distinct >= withTarget.length * 0.9) {
      droppedColumns.push({ name: col.name, reason: "identifier-like column" });
      return;
    }
    featureCols.push({
      index: i,
      name: col.name,
      kind: col.type === "numeric" ? "numeric" : "indexed",
    });
  });

  if (featureCols.length === 0) {
    throw new PipelineError(
      "No usable feature columns remain after cleaning. The dataset needs at least one informative column besides the target.",
    );
  }

  // --- imputation + StringIndexer ---
  let missingValuesImputed = 0;
  const encoders = featureCols.map((col) => {
    if (col.kind === "numeric") {
      const nums = withTarget
        .map((r) => toNumber(r[col.index] ?? ""))
        .filter((n): n is number => n !== null);
      const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      return { col, mean, index: null as Map<string, number> | null };
    }
    const freq = new Map<string, number>();
    for (const r of withTarget) {
      const v = r[col.index] ?? "";
      if (isMissing(v)) continue;
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    const ordered = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    const index = new Map<string, number>();
    ordered.forEach((v, i) => index.set(v, i));
    return { col, mean: 0, index };
  });

  const labelIndex = new Map<string, number>();
  const labelNames: string[] = [];
  const labelCounts: number[] = [];
  const X: number[][] = [];
  const y: number[] = [];

  for (const r of withTarget) {
    const vector: number[] = [];
    for (const enc of encoders) {
      const raw = r[enc.col.index] ?? "";
      if (enc.index) {
        if (isMissing(raw)) {
          missingValuesImputed++;
          vector.push(0);
        } else vector.push(enc.index.get(raw) ?? 0);
      } else {
        const n = toNumber(raw);
        if (n === null) {
          missingValuesImputed++;
          vector.push(enc.mean);
        } else vector.push(n);
      }
    }
    const labelRaw = (r[targetIdx] ?? "").trim();
    let li = labelIndex.get(labelRaw);
    if (li === undefined) {
      li = labelNames.length;
      labelIndex.set(labelRaw, li);
      labelNames.push(labelRaw);
      labelCounts.push(0);
    }
    labelCounts[li] = (labelCounts[li] ?? 0) + 1;
    X.push(vector);
    y.push(li);
  }

  // --- optional sampling for responsiveness on very large files ---
  const rng = makeRng(42);
  let sampledFrom: number | null = null;
  let Xs = X;
  let ys = y;
  if (X.length > MAX_TRAINING_ROWS) {
    sampledFrom = X.length;
    const idx = X.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    const keep = idx.slice(0, MAX_TRAINING_ROWS);
    Xs = keep.map((i) => X[i]!);
    ys = keep.map((i) => y[i]!);
  }

  // --- randomSplit([0.8, 0.2]) stratified by label ---
  const byLabel = new Map<number, number[]>();
  ys.forEach((label, i) => {
    const arr = byLabel.get(label) ?? [];
    arr.push(i);
    byLabel.set(label, arr);
  });
  const trainIdx: number[] = [];
  const testIdx: number[] = [];
  for (const [, idxs] of byLabel) {
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j]!, idxs[i]!];
    }
    const cut = Math.max(1, Math.round(idxs.length * 0.8));
    idxs.forEach((v, i) => (i < cut ? trainIdx : testIdx).push(v));
  }
  if (testIdx.length === 0) {
    throw new PipelineError("Not enough rows to create a test split. Provide more data.");
  }

  const Xtrain = trainIdx.map((i) => Xs[i]!);
  const ytrain = trainIdx.map((i) => ys[i]!);
  const Xtest = testIdx.map((i) => Xs[i]!);
  const ytest = testIdx.map((i) => ys[i]!);

  // --- RandomForestClassifier.fit() ---
  const numTrees = Xtrain.length > 8000 ? 20 : 40;
  const maxDepth = 8;
  const start = Date.now();
  const forest = trainForest(Xtrain, ytrain, {
    numTrees,
    maxDepth,
    minInstancesPerNode: 2,
    numClasses: labelNames.length,
    seed: 42,
  });
  const trainingTimeMs = Date.now() - start;

  // --- model.transform(testDf) ---
  const predicted = Xtest.map((row) => predictForest(forest, row));
  const evaluation = evaluate(ytest, predicted, labelNames);

  const predictions: PredictionRow[] = predicted.slice(0, 50).map((p, i) => ({
    record: i + 1,
    actual: labelNames[ytest[i]!]!,
    predicted: labelNames[p]!,
    correct: p === ytest[i],
  }));

  const predictionCounts = labelNames.map((label, li) => ({
    label,
    predicted: predicted.filter((p) => p === li).length,
    actual: ytest.filter((a) => a === li).length,
  }));

  return {
    summary,
    target,
    cleaning: {
      rowsBefore: rows.length,
      duplicatesRemoved,
      rowsWithMissingTarget,
      rowsAfter: withTarget.length,
      missingValuesImputed,
      outliersFlagged: summary.validation.totalOutliers,
      droppedColumns,
    },
    features: featureCols.map((f, i) => ({
      name: f.name,
      kind: f.kind,
      importance: forest.featureImportances[i] ?? 0,
    })),
    labels: labelNames.map((name, i) => ({ name, count: labelCounts[i] ?? 0 })),
    training: {
      model: "RandomForestClassifier",
      numTrees,
      maxDepth,
      trainCount: Xtrain.length,
      testCount: Xtest.length,
      sampledFrom,
      trainingTimeMs,
    },
    evaluation,
    predictions,
    predictionCounts,
  };
}
