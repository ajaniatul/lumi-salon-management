"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type HeaderButton = { label: string; onClick: () => void; variant?: "primary" | "outline"; icon?: "wallet" };
export type HeaderAction = HeaderButton | HeaderButton[] | null;

const HeaderActionContext = createContext<{
  action: HeaderAction;
  setAction: (a: HeaderAction) => void;
}>({ action: null, setAction: () => {} });

export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<HeaderAction>(null);
  const setAction = useCallback((a: HeaderAction) => setActionState(a), []);
  return (
    <HeaderActionContext.Provider value={{ action, setAction }}>
      {children}
    </HeaderActionContext.Provider>
  );
}

export const useHeaderAction = () => useContext(HeaderActionContext);
