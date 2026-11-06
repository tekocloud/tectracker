import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal focus containment, Escape handling and focus restoration. */
export default function Modal({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      className="modal-shell"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      <span className="sr-only" id={titleId}>
        {title}
      </span>
      {children}
      <button
        type="button"
        className="modal-close icon"
        aria-label="Dialog schließen"
        onClick={onClose}
      >
        <X size={18} />
      </button>
    </dialog>
  );
}
