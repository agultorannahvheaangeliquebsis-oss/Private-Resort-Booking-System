import { redirect } from "next/navigation";

export default function Home() {
  // The dashboard is the app. Unauthenticated users are bounced to /login
  // by the route guard in proxy.ts.
  redirect("/dashboard");
}
