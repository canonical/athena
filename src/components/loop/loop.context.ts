import { createContext, useContext } from "react";
import type { PersonaListState } from "../persona/persona.query.js";
import type { Feedback, Loop } from "./loop.schema.js";

export type LoopContextValue = {
  loop: Loop;
  reloadLoop: () => void;
  personaListState: PersonaListState;
  reloadPersonaList: () => void;
  onFeedback: (feedback: Feedback | null) => void;
};

export const LoopContext = createContext<LoopContextValue | null>(null);

export function useLoopLayoutContext() {
  const context = useContext(LoopContext);

  if (!context) {
    throw new Error(`Loop route content must be rendered inside LoopLayout.`);
  }

  return context;
}
