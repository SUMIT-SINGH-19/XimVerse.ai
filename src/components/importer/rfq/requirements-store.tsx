"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MOCK_REQUIREMENTS, nextRequirementId, type ImportRequirement } from "@/lib/import-requirements";
import { agreementFor } from "@/lib/importer-negotiations";
import { useNegotiations } from "../negotiations/negotiation-store";

/*
 * Requirements for the importer workspace, held in memory for this browser tab.
 * It starts from the mock data; requirements created in the UI are added here
 * and are lost on reload. Replace with API calls once a backend exists.
 *
 * Supplier selection is not stored here: a requirement with an agreed
 * negotiation is presented as "Supplier Selected" with its `selection`.
 */

interface RequirementsStore {
  requirements: readonly ImportRequirement[];
  find: (id: string) => ImportRequirement | undefined;
  /** Inserts or replaces by id. */
  save: (requirement: ImportRequirement) => void;
  nextId: () => string;
}

const RequirementsContext = createContext<RequirementsStore | null>(null);

export function ImportRequirementsProvider({ children }: { children: React.ReactNode }) {
  const [stored, setRequirements] = useState<readonly ImportRequirement[]>(MOCK_REQUIREMENTS);
  const negotiations = useNegotiations();
  const requirements = useMemo(
    () =>
      stored.map((r) => {
        const agreed = agreementFor(r.id, negotiations);
        return agreed
          ? {
              ...r,
              status: "supplier-selected" as const,
              selection: { negotiationId: agreed.id, quotationId: agreed.quotationId, supplierId: agreed.supplierId },
            }
          : r;
      }),
    [stored, negotiations],
  );

  const save = useCallback((requirement: ImportRequirement) => {
    setRequirements((current) => {
      const rest = current.filter((r) => r.id !== requirement.id);
      return [requirement, ...rest];
    });
  }, []);

  const value = useMemo<RequirementsStore>(
    () => ({
      requirements,
      find: (id) => requirements.find((r) => r.id === id),
      save,
      nextId: () => nextRequirementId(requirements, new Date().getFullYear()),
    }),
    [requirements, save],
  );

  return <RequirementsContext.Provider value={value}>{children}</RequirementsContext.Provider>;
}

export function useImportRequirements(): RequirementsStore {
  const store = useContext(RequirementsContext);
  if (!store) throw new Error("useImportRequirements must be used inside ImportRequirementsProvider");
  return store;
}
