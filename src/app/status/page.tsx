import type { Metadata } from "next";
import { StatusLookup } from "@/components/StatusLookup";

export const metadata: Metadata = {
  title: "Fabian's Azzure — Check Your Reservation",
  description: "Look up the status of a booking request by reference code.",
};

export default function StatusPage() {
  return <StatusLookup />;
}
