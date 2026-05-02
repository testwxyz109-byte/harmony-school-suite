import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";
export const Route = createFileRoute("/_app/payroll")({ component: () => <ComingSoon title="Payroll" /> });
