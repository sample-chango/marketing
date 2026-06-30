"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

type ChangeAnalysis = {
  showChange: boolean;
  setShowChange: (show: boolean) => void;
  toggle: () => void;
};

const ChangeContext = createContext<ChangeAnalysis>({
  showChange: false,
  setShowChange: () => {},
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

  useEffect(() => {
    if (pathname !== "/") setShowChange(false);
  }, [pathname]);

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
      value={{
        showChange,
        setShowChange,
        toggle: () => setShowChange((value) => !value),
      }}
    >
      <Sidebar isAdmin={isAdmin} />
      <div className="min-h-full md:pl-60">{children}</div>
    </ChangeContext.Provider>
  );
}
