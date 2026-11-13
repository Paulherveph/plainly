import { GuestGateProvider } from "@/shared/ui/guest-gate";

/** App pages: a guest is created on the first action, never on page view (E01). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <GuestGateProvider>{children}</GuestGateProvider>;
}
