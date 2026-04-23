import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </main>
      </div>
    </div>
  );
}
