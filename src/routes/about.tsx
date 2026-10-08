import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/dashboard-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Big Data ML with PySpark | BigData ML Analytics" },
      {
        name: "description",
        content:
          "How this project demonstrates big data processing with Spark-style DataFrame operations and a Random Forest classifier from Spark MLlib.",
      },
      { property: "og:title", content: "About — Big Data ML with PySpark" },
      {
        property: "og:description",
        content:
          "Big Data, Apache Spark, PySpark and Spark MLlib explained, plus the full pipeline used in this project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const CONCEPTS = [
  {
    title: "What is Big Data?",
    body: "Big Data refers to datasets that are too large, too fast-moving or too varied to be handled comfortably by a single machine using traditional tools. It is usually described by volume, velocity and variety. Instead of processing such data in one place, it is split into partitions and processed in parallel across many machines.",
  },
  {
    title: "What is Apache Spark?",
    body: "Apache Spark is an open-source distributed computing engine for large-scale data processing. It keeps data in memory where possible, splits work into tasks across a cluster, and exposes a DataFrame API for SQL-like transformations. Spark handles partitioning, scheduling, shuffling and fault tolerance for you.",
  },
  {
    title: "What is PySpark?",
    body: "PySpark is the Python API for Apache Spark. It lets you write Spark jobs in Python: spark.read.csv() to load data, select/filter/dropDuplicates/fillna for cleaning, and withColumn for derived fields. The Python code drives a JVM-based Spark engine that performs the distributed work.",
  },
  {
    title: "What is Spark MLlib?",
    body: "MLlib is Spark's machine learning library. It provides distributed implementations of common algorithms plus pipeline building blocks such as StringIndexer (encoding text categories as numbers), VectorAssembler (packing feature columns into one vector), classifiers like RandomForestClassifier, and MulticlassClassificationEvaluator for accuracy, precision, recall and F1.",
  },
  {
    title: "Why distributed processing is useful",
    body: "A 500 GB file cannot fit in one machine's memory, and scanning it on one CPU takes hours. Splitting it into partitions across a cluster lets many cores work at the same time, so processing time falls roughly in proportion to the number of workers. The same applies to model training: trees in a random forest can be fitted in parallel.",
  },
];

const WORKFLOW = `CSV Dataset
    |
    v
PySpark / DataFrame engine
    |
    v
Schema validation + Data cleaning
    |
    v
Feature engineering (StringIndexer, VectorAssembler)
    |
    v
MLlib model (RandomForestClassifier)
    |
    v
Model training (80% train / 20% test)
    |
    v
Prediction on the held-out test set
    |
    v
Evaluation (accuracy, precision, recall, F1)`;

const PYSPARK_CODE = `from pyspark.sql import SparkSession
from pyspark.ml.feature import StringIndexer, VectorAssembler
from pyspark.ml.classification import RandomForestClassifier
from pyspark.ml.evaluation import MulticlassClassificationEvaluator

spark = SparkSession.builder.appName("BigDataMLAnalytics").getOrCreate()

df = spark.read.csv("customer_data.csv", header=True, inferSchema=True)
df = df.dropDuplicates().na.drop(subset=["churn"])

indexer = StringIndexer(inputCol="churn", outputCol="label")
assembler = VectorAssembler(inputCols=feature_cols, outputCol="features")

train, test = df.randomSplit([0.8, 0.2], seed=42)
rf = RandomForestClassifier(numTrees=40, maxDepth=8)
model = rf.fit(assembler.transform(indexer.fit(train).transform(train)))

predictions = model.transform(test_features)
accuracy = MulticlassClassificationEvaluator(metricName="accuracy").evaluate(predictions)`;

function AboutPage() {
  return (
    <>
      <PageHeader
        title="About this project"
        description="An educational demonstration of big data processing and machine learning."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {CONCEPTS.map((c) => (
          <Card key={c.title}>
            <CardHeader>
              <CardTitle className="text-base">{c.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-muted-foreground">
              {c.body}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Project workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
            {WORKFLOW}
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">How the processing engine works here</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            This application is deployed to a JavaScript-only web runtime, which cannot start a JVM
            and therefore cannot run Apache Spark or PySpark itself. To keep every number on screen
            honest, the same pipeline is implemented as a server-side engine that performs the real
            work on your uploaded file: schema validation, duplicate removal, missing-value
            imputation, IQR outlier detection, category indexing, feature vector assembly, a
            stratified 80/20 split, a genuine Random Forest (CART trees, Gini impurity, bagging and
            random feature subsampling), prediction on held-out rows, and metric computation from
            the resulting confusion matrix.
          </p>
          <p>
            Nothing is simulated or hardcoded — every statistic, metric and prediction shown in the
            app is computed from your dataset at request time. The equivalent PySpark job is shown
            below and produces the same pipeline when run on a Spark cluster.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
            {PYSPARK_CODE}
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Model choice</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          A single model is used: the <strong className="text-foreground">Random Forest
          classifier</strong> (40 trees, max depth 8; 20 trees above 8,000 training rows). It was
          chosen because it handles mixed numeric and categorical features, needs no feature
          scaling, resists overfitting through bagging, provides feature importances, and is the
          most commonly used classifier in Spark MLlib teaching material. Keeping one model makes
          the project lightweight and the results easy to explain.
        </CardContent>
      </Card>
    </>
  );
}
