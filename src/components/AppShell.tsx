"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

type ChangeAnalysis = { showChange: boolean; toggle: () => void };

const ChangeContext = createContext<ChangeAnalysis>({
  showChange: false,
  toggle: () => {},
});

export const useChangeAnalysis = () => useContext(ChangeContext);

export function AppShell({
  email,
  isAdmin,
  children,
}: {
  email: string | null;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showChange, setShowChange] = useState(false);

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/pending" ||
    !email
  ) {
    return <>{children}</>;
  }

  return (
    <ChangeContext.Provider
      value={{ showChange, toggle: () => setShowChange((value) => !value) }}
    >
      <Sidebar isAdmin={isAdmin} />
      <div className="min-h-full md:pl-64">{children}</div>
    </ChangeContext.Provider>
  );
}
