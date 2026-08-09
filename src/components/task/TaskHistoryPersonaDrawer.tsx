import { EntityDrawer } from "@components/base/EntityDrawer.js";
import { Persona } from "../persona/Persona.js";

type TaskHistoryPersonaDrawerProps = {
  personaId: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export function TaskHistoryPersonaDrawer({ personaId, isOpen, onClose }: TaskHistoryPersonaDrawerProps) {
  return (
    <EntityDrawer isOpen={isOpen} onClose={onClose} title="Persona details">
      {personaId ? <Persona personaId={personaId} /> : null}
    </EntityDrawer>
  );
}
