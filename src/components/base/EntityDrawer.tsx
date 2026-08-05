import { Modal } from "@canonical/react-components";
import type { ReactNode } from "react";

type EntityDrawerProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: `default` | `large` | `xl`;
};

export function EntityDrawer({ title, isOpen, onClose, children, size = `default` }: EntityDrawerProps) {
  if (!isOpen) {
    return null;
  }

  const drawerClassName = size === `large` ? `athena-entity-drawer athena-entity-drawer--large` : size === `xl` ? `athena-entity-drawer athena-entity-drawer--xl` : `athena-entity-drawer`;

  return (
    <Modal className={drawerClassName} close={onClose} closeOnOutsideClick={false} title={title}>
      {children}
    </Modal>
  );
}
