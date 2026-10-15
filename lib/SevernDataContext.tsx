"use client";

import { createContext, ReactNode, useContext } from "react";
import { SevernData, useSevernData } from "@/lib/hooks";

// One fetch for the whole page. The spill card, the outfall list and the
// rainfall card all read the same two responses, and the sewage route's
// reverse-geocoding pass is expensive enough that it shouldn't run three
// times per refresh just because three cards want it. The nav bar needs the same
// state again for its refresh button and freshness line, which is what pushed
// this from a module-level singleton to real context.
const SevernDataContext = createContext<SevernData | null>(null);

export const SevernDataProvider = ({ children }: { children: ReactNode }) => {
  const value = useSevernData();
  return (
    <SevernDataContext.Provider value={value}>
      {children}
    </SevernDataContext.Provider>
  );
};

export const useSevernContext = (): SevernData => {
  const context = useContext(SevernDataContext);
  if (!context) {
    throw new Error(
      "useSevernContext must be used inside a SevernDataProvider (see app/layout.tsx)"
    );
  }
  return context;
};
