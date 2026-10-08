# Big Data & ML Analytics

A web-based Big Data and Machine Learning analytics application built with **React, TypeScript, TanStack Start, Vite, and Tailwind CSS**.

The application lets users upload CSV datasets, inspect and validate the data, perform data cleaning and analysis, train a Random Forest classification model, evaluate model performance, and view prediction/results history.

> **Note:** The project implements a Spark/MLlib-style machine-learning pipeline in TypeScript for local/server-side execution. It does not require a separate Apache Spark cluster.

## Features

- CSV dataset upload and parsing
- Dataset schema detection and profiling
- Data preview and validation
- Missing-value detection and handling
- Duplicate and outlier analysis
- Numeric and categorical feature analysis
- Target-column selection
- Feature preparation and encoding
- 80/20 train-test split
- Random Forest classification
- Model evaluation and metrics
- Feature-importance analysis
- Prediction results
- Analysis history
- Responsive analytics dashboard

## Machine Learning Pipeline

The project follows this general workflow:

```text
CSV Dataset
    ↓
Data Loading & Parsing
    ↓
Schema Inference
    ↓
Data Validation
    ↓
Data Cleaning
    ↓
Feature Preparation
    ↓
Train/Test Split
    ↓
Random Forest Classifier
    ↓
Prediction
    ↓
Model Evaluation
    ↓
Analytics & Results
```

### Random Forest

The project contains a custom Random Forest implementation using:

- CART-style decision trees
- Gini impurity
- Bootstrap sampling (bagging)
- Random feature selection at each split
- Configurable tree count and maximum depth
- Deterministic random seed for reproducible results
- Feature-importance calculation

## Technology Stack

- **React 19**
- **TypeScript**
- **TanStack Start / TanStack Router**
- **Vite**
- **Tailwind CSS**
- **Recharts**
- **Radix UI**
- **Lucide React**
- **Zod**
- **Node.js**

## Project Structure

```text
bigdata-ml-analytics/
├── public/
│   ├── sample_customer_churn.csv
│   └── ...
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   └── ml/
│   │       ├── csv.ts
│   │       ├── metrics.ts
│   │       ├── pipeline.ts
│   │       └── random-forest.ts
│   ├── routes/
│   │   ├── data-processing.tsx
│   │   ├── dataset-analysis.tsx
│   │   ├── history.tsx
│   │   ├── ml-analysis.tsx
│   │   └── results.tsx
│   └── ...
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

Install:

- Node.js
- npm

Check your installation:

```bash
node --version
npm --version
```

### Installation

Clone the repository:

```bash
git clone <YOUR-GITHUB-REPOSITORY-URL>
```

Open the project folder:

```bash
cd bigdata-ml-analytics
```

Install dependencies:

```bash
npm install
```

### Run the Development Server

```bash
npm run dev
```

Then open the local URL shown in the terminal.

## Build for Production

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## Code Quality

Run ESLint:

```bash
npm run lint
```

Format the project:

```bash
npm run format
```

## Using the Application

1. Open the application.
2. Go to **Data Processing**.
3. Upload a CSV dataset.
4. Review the detected columns and validation results.
5. Continue to dataset analysis.
6. Select a suitable target column for classification.
7. Open **ML Analysis**.
8. Start model training.
9. Review accuracy and other evaluation metrics.
10. Inspect predictions and feature importance in **Results**.
11. Use **History** to review previous analyses when available.

A sample customer-churn dataset is included at:

```text
public/sample_customer_churn.csv
```

## Dataset Requirements

For ML training, use a CSV dataset with:

- A header row
- At least 20 data rows
- A suitable target column
- At least two target classes for classification
- Feature columns with useful variation

The application performs validation before training and reports issues such as missing values, duplicate columns, invalid numeric values, constant columns, and outliers.

## Important Note About Large Datasets

The ML pipeline has a training-row limit of **20,000 rows** (`MAX_TRAINING_ROWS`) to keep browser/server-side processing practical.

For very large Big Data workloads, a distributed system such as Apache Spark would normally be more appropriate.

## License

This project is released under the **MIT License**. See the [LICENSE](LICENSE) file for details.

Third-party libraries included in this project remain subject to their respective licenses.

## Author

**Your Name**

Replace `Your Name` with your name or GitHub profile before publishing if desired.

## Acknowledgements

This project uses open-source libraries from the React, TanStack, Vite, Tailwind CSS, Radix UI, Recharts, and related ecosystems.
