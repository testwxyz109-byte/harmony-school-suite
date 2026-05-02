import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppLayout";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/_app/attendance")({ component: () => <ComingSoon title="Attendance" /> });

function ComingSoon({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} description="Coming in the next iteration" />
      <div className="card-soft flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          <Construction className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">{title} module coming next</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The database, schema, and access rules for this module are already set up. The UI will be built in the next turn.
        </p>
      </div>
    </div>
  );
}

export { ComingSoon };
