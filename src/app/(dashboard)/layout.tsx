import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { HeaderActionProvider } from "@/components/layout/HeaderActionContext";
import { prisma } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const settings = await prisma.salonSettings.findFirst();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#FAFAF8" }}>
      {/* Sidebar */}
      <Sidebar
        userRole={session.role}
        userName={session.name}
        brandLogo={settings?.logo || null}
        brandName={settings?.salonName || "Lumi"}
        brandTagline={settings?.tagline || "Beauty Lounge"}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <HeaderActionProvider>
          <Header
            userRole={session.role}
            userName={session.name}
          />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto py-6 scrollbar-thin">
            {children}
          </main>
        </HeaderActionProvider>
      </div>
    </div>
  );
}
