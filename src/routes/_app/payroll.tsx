import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "./attendance";
export const Route = createFileRoute("/_app/payroll")({ component: () => <ComingSoon title="Payroll" /> });
