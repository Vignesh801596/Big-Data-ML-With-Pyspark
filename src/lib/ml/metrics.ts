export type ClassMetric = {
  label: string;
  support: number;
  precision: number;
  recall: number;
  f1: number;
};

export type EvaluationResult = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  perClass: ClassMetric[];
  confusion: number[][];
};

/** Weighted (support-weighted) precision/recall/F1, as Spark's MulticlassClassificationEvaluator reports. */
export function evaluate(
  actual: number[],
  predicted: number[],
  labels: string[],
): EvaluationResult {
  const k = labels.length;
  const confusion = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < actual.length; i++) confusion[actual[i]!]![predicted[i]!]!++;

  let correct = 0;
  for (let i = 0; i < k; i++) correct += confusion[i]![i]!;
  const total = actual.length || 1;

  const perClass: ClassMetric[] = labels.map((label, i) => {
    const tp = confusion[i]![i]!;
    let predPos = 0;
    let support = 0;
    for (let j = 0; j < k; j++) {
      predPos += confusion[j]![i]!;
      support += confusion[i]![j]!;
    }
    const precision = predPos === 0 ? 0 : tp / predPos;
    const recall = support === 0 ? 0 : tp / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return { label, support, precision, recall, f1 };
  });

  const weighted = (pick: (m: ClassMetric) => number) =>
    perClass.reduce((acc, m) => acc + pick(m) * m.support, 0) / total;

  return {
    accuracy: correct / total,
    precision: weighted((m) => m.precision),
    recall: weighted((m) => m.recall),
    f1: weighted((m) => m.f1),
    perClass,
    confusion,
  };
}
