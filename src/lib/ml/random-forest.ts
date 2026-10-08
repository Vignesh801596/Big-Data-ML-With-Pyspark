// A real Random Forest classifier (CART trees, Gini impurity, bagging,
// random feature subsampling at each split). Mirrors the behaviour of
// Spark MLlib's RandomForestClassifier on a single machine.

export type Matrix = number[][];

type Leaf = { leaf: true; prediction: number; counts: number[] };
type Node = { leaf: false; feature: number; threshold: number; left: TreeNode; right: TreeNode };
export type TreeNode = Leaf | Node;

export type ForestOptions = {
  numTrees: number;
  maxDepth: number;
  minInstancesPerNode: number;
  numClasses: number;
  seed: number;
};

/** Deterministic PRNG so results are reproducible for a given dataset + seed. */
export function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function classCounts(labels: number[], idx: number[], numClasses: number): number[] {
  const counts = new Array<number>(numClasses).fill(0);
  for (const i of idx) counts[labels[i]!]!++;
  return counts;
}

function gini(counts: number[], total: number): number {
  if (total === 0) return 0;
  let sum = 0;
  for (const c of counts) {
    const p = c / total;
    sum += p * p;
  }
  return 1 - sum;
}

function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i]! > arr[best]!) best = i;
  return best;
}

function candidateThresholds(values: number[], rng: () => number): number[] {
  const uniq = Array.from(new Set(values)).sort((a, b) => a - b);
  if (uniq.length <= 1) return [];
  const maxBins = 24;
  const mids: number[] = [];
  for (let i = 1; i < uniq.length; i++) mids.push((uniq[i - 1]! + uniq[i]!) / 2);
  if (mids.length <= maxBins) return mids;
  const step = mids.length / maxBins;
  const picked: number[] = [];
  for (let b = 0; b < maxBins; b++) {
    picked.push(mids[Math.min(mids.length - 1, Math.floor(b * step + rng() * step * 0.5))]!);
  }
  return picked;
}

function buildTree(
  X: Matrix,
  y: number[],
  idx: number[],
  depth: number,
  featuresPerSplit: number,
  opts: ForestOptions,
  rng: () => number,
): TreeNode {
  const counts = classCounts(y, idx, opts.numClasses);
  const total = idx.length;
  const impurity = gini(counts, total);

  if (depth >= opts.maxDepth || total < opts.minInstancesPerNode * 2 || impurity === 0) {
    return { leaf: true, prediction: argmax(counts), counts };
  }

  const numFeatures = X[0]!.length;
  const featureIdx: number[] = [];
  const pool = Array.from({ length: numFeatures }, (_, i) => i);
  for (let i = 0; i < featuresPerSplit && pool.length > 0; i++) {
    featureIdx.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;

  for (const f of featureIdx) {
    const values = idx.map((i) => X[i]![f]!);
    for (const t of candidateThresholds(values, rng)) {
      const leftCounts = new Array<number>(opts.numClasses).fill(0);
      const rightCounts = new Array<number>(opts.numClasses).fill(0);
      let nLeft = 0;
      for (const i of idx) {
        if (X[i]![f]! <= t) {
          leftCounts[y[i]!]!++;
          nLeft++;
        } else rightCounts[y[i]!]!++;
      }
      const nRight = total - nLeft;
      if (nLeft < opts.minInstancesPerNode || nRight < opts.minInstancesPerNode) continue;
      const gain =
        impurity -
        (nLeft / total) * gini(leftCounts, nLeft) -
        (nRight / total) * gini(rightCounts, nRight);
      if (gain > bestGain + 1e-9) {
        bestGain = gain;
        bestFeature = f;
        bestThreshold = t;
      }
    }
  }

  if (bestFeature < 0) return { leaf: true, prediction: argmax(counts), counts };

  const left: number[] = [];
  const right: number[] = [];
  for (const i of idx) (X[i]![bestFeature]! <= bestThreshold ? left : right).push(i);

  return {
    leaf: false,
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildTree(X, y, left, depth + 1, featuresPerSplit, opts, rng),
    right: buildTree(X, y, right, depth + 1, featuresPerSplit, opts, rng),
  };
}

function predictTree(node: TreeNode, row: number[]): number {
  let cur = node;
  while (!cur.leaf) cur = row[cur.feature]! <= cur.threshold ? cur.left : cur.right;
  return cur.prediction;
}

function featureUsage(node: TreeNode, out: number[], weight: number) {
  if (node.leaf) return;
  out[node.feature] = (out[node.feature] ?? 0) + weight;
  featureUsage(node.left, out, weight * 0.5);
  featureUsage(node.right, out, weight * 0.5);
}

export type Forest = {
  trees: TreeNode[];
  numClasses: number;
  featureImportances: number[];
};

export function trainForest(X: Matrix, y: number[], opts: ForestOptions): Forest {
  const rng = makeRng(opts.seed);
  const n = X.length;
  const numFeatures = X[0]!.length;
  const featuresPerSplit = Math.max(1, Math.round(Math.sqrt(numFeatures)));
  const trees: TreeNode[] = [];

  for (let t = 0; t < opts.numTrees; t++) {
    const sample: number[] = new Array(n);
    for (let i = 0; i < n; i++) sample[i] = Math.floor(rng() * n);
    trees.push(buildTree(X, y, sample, 0, featuresPerSplit, opts, rng));
  }

  const importances = new Array<number>(numFeatures).fill(0);
  for (const tree of trees) featureUsage(tree, importances, 1);
  const sum = importances.reduce((a, b) => a + b, 0) || 1;

  return { trees, numClasses: opts.numClasses, featureImportances: importances.map((v) => v / sum) };
}

export function predictForest(forest: Forest, row: number[]): number {
  const votes = new Array<number>(forest.numClasses).fill(0);
  for (const tree of forest.trees) votes[predictTree(tree, row)]!++;
  return argmax(votes);
}
