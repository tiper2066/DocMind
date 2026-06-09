import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/nav/TopNav";
import { Toaster } from "@/components/ui/sonner";
import { FolderStoreProvider } from "@/lib/folders/store";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <FolderStoreProvider>
      <div className="flex min-h-svh flex-col">
        <TopNav />
        <div className="flex-1">{children}</div>
        <Toaster />
      </div>
    </FolderStoreProvider>
  );
}
