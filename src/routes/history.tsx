import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Trash2 } from "lucide-react";
import { PageHeader, MetricCard, num, pct } from "@/components/dashboard-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clearHistory, restoreResult, useAppState } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Prediction History — BigData ML Analytics" },
      { name: "description", content: "Review and restore locally saved Random Forest evaluation runs." },
      { property: "og:title", content: "Prediction History — BigData ML Analytics" },
      { property: "og:description", content: "Local history of customer data model runs and evaluation results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { history } = useAppState();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader 
        title="Prediction History" 
        description="Local record of previous ML model training and evaluation runs." 
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <MetricCard label="Stored Runs" value={history.length} />
          <MetricCard 
            label="Avg. Accuracy" 
            value={history.length > 0 ? pct(history.reduce((sum, entry) => sum + entry.result.evaluation.accuracy, 0) / history.length) : "—"}
          />
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={history.length === 0}>
              <Trash2 className="size-4" />
              Clear history
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear prediction history?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes all locally saved runs. Your currently loaded results remain available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearHistory}>Clear history</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historical Runs</CardTitle>
          <CardDescription>Restore any previous analysis without running the model again.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="py-14 text-center">
              <p className="font-medium text-foreground">No saved model runs</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Train the Random Forest model to save its dataset, prediction, and evaluation summary here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">Latest prediction</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <p className="font-mono text-xs">{entry.result.summary.fileName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                        {entry.result.target}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{num(entry.result.summary.rowCount)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">
                      {pct(entry.result.evaluation.accuracy)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {entry.result.predictions[0]?.predicted ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          restoreResult(entry.result);
                          void navigate({ to: "/results" });
                        }}
                      >
                        <ArrowUpRight className="mr-2 size-4" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
