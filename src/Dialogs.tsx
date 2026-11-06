import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Modal from "./Modal";

type Request = {
  message: string;
  initial?: string;
  resolve: (value: string | null) => void;
};
const Context = createContext<{
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, initial?: string) => Promise<string | null>;
} | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const pending = useRef<Request | null>(null);
  const inputId = useId();
  const ask = useCallback(
    (message: string, initial?: string) =>
      new Promise<string | null>((resolve) => {
        // Never leave an earlier caller waiting if two actions arrive together.
        pending.current?.resolve(null);
        const next = { message, initial, resolve };
        pending.current = next;
        setRequest(next);
      }),
    [],
  );
  const finish = (value: string | null) => {
    pending.current?.resolve(value);
    pending.current = null;
    setRequest(null);
  };
  return (
    <Context.Provider
      value={{
        confirm: async (message) => (await ask(message)) !== null,
        prompt: (message, initial = "") => ask(message, initial),
      }}
    >
      {children}
      {request && (
        <Modal
          key={request.message}
          title={
            request.initial === undefined ? "Bitte bestätigen" : request.message
          }
          onClose={() => finish(null)}
        >
          <form
            className="modal confirmation-modal"
            onSubmit={(event) => {
              event.preventDefault();
              finish(
                request.initial === undefined
                  ? "confirmed"
                  : String(new FormData(event.currentTarget).get("answer")),
              );
            }}
          >
            <div className="dialog-symbol" aria-hidden="true">
              {request.initial === undefined ? "?" : "✎"}
            </div>
            <h2>
              {request.initial === undefined
                ? "Bitte bestätigen"
                : request.message}
            </h2>
            {request.initial === undefined ? (
              <p className="dialog-message">{request.message}</p>
            ) : (
              <>
                <label htmlFor={inputId}>Eingabe</label>
                <input
                  id={inputId}
                  name="answer"
                  defaultValue={request.initial}
                  autoFocus
                  autoComplete="off"
                />
              </>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                autoFocus={request.initial === undefined}
                onClick={() => finish(null)}
              >
                Abbrechen
              </button>
              <button className="primary">
                {request.initial === undefined ? "Bestätigen" : "Übernehmen"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Context.Provider>
  );
}

export function useDialogs() {
  const dialogs = useContext(Context);
  if (!dialogs) throw Error("DialogProvider fehlt.");
  return dialogs;
}
