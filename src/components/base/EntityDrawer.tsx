import { Modal } from "@canonical/react-components";
import type { ReactNode } from "react";

type EntityDrawerProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function EntityDrawer({ title, isOpen, onClose, children }: EntityDrawerProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal className="athena-entity-drawer" close={onClose} closeOnOutsideClick={false} title={title}>
      {children}
    </Modal>
  );
}
