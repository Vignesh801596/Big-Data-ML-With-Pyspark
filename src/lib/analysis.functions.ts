import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PipelineError, runPipeline, summarize } from "./ml/pipeline";

const MAX_BYTES = 12_000_000;

const inspectSchema = z.object({
  fileName: z.string().min(1),
  csvText: z.string().min(1).max(MAX_BYTES),
});

const analyzeSchema = inspectSchema.extend({
  target: z.string().min(1),
});

function toMessage(error: unknown): string {
  if (error instanceof PipelineError) return error.message;
  console.error(error);
  return "Processing failed while reading this dataset. Check that the file is a valid CSV.";
}

export const inspectDataset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inspectSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, summary: summarize(data.fileName, data.csvText) };
    } catch (error) {
      return { ok: false as const, error: toMessage(error) };
    }
  });

export const analyzeDataset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => analyzeSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, result: runPipeline(data.fileName, data.csvText, data.target) };
    } catch (error) {
      return { ok: false as const, error: toMessage(error) };
    }
  });
