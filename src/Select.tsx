import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

/** Keep native form/label semantics; render the popup in the app's theme. */
export default function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const ref = useRef<HTMLSelectElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 280,
  });
  const id = useId();
  const search = useRef({ value: "", time: 0 });
  const options = open && ref.current ? Array.from(ref.current.options) : [];
  function show() {
    if (props.disabled) return;
    setActive(ref.current?.selectedIndex ?? 0);
    setOpen(true);
  }
  function choose(index: number) {
    const select = ref.current!;
    if (!select.options[index] || select.options[index].disabled) return;
    select.value = select.options[index].value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setOpen(false);
    select.focus();
  }
  useLayoutEffect(() => {
    if (!open) return;
    const select = ref.current!;
    const rect = select.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const height = Math.min(280, Math.max(below, above));
    const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 24);
    setPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top:
        below >= Math.min(280, select.options.length * 38 + 12) ||
        below >= above
          ? rect.bottom + 6
          : Math.max(
              12,
              rect.top - Math.min(height, select.options.length * 38 + 12) - 6,
            ),
      width,
      maxHeight: height,
    });
    const outside = (event: PointerEvent) => {
      if (
        !popup.current?.contains(event.target as Node) &&
        !select.contains(event.target as Node)
      )
        setOpen(false);
    };
    const close = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (open)
      popup.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  return (
    <span className={`app-select ${open ? "is-open" : ""}`}>
      <select
        {...props}
        ref={ref}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onPointerDown={(event) => {
          event.preventDefault();
          ref.current?.focus();
          if (open) setOpen(false);
          else show();
        }}
        onClick={(event) => {
          event.preventDefault();
          if (event.detail === 0) show();
        }}
        onBlur={(event) => {
          setOpen(false);
          props.onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            return;
          }
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (
            ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            if (!open) {
              show();
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              choose(active);
              return;
            }
            const enabled = options
              .map((option, index) => (option.disabled ? -1 : index))
              .filter((i) => i >= 0);
            const current = enabled.indexOf(active);
            const index =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? enabled.length - 1
                  : Math.max(
                      0,
                      Math.min(
                        enabled.length - 1,
                        current + (event.key === "ArrowDown" ? 1 : -1),
                      ),
                    );
            setActive(enabled[index] ?? active);
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const value =
              Date.now() - search.current.time > 700
                ? event.key
                : search.current.value + event.key;
            search.current = { value, time: Date.now() };
            const index = Array.from(ref.current!.options).findIndex(
              (option) =>
                !option.disabled &&
                option.text
                  .toLocaleLowerCase()
                  .startsWith(value.toLocaleLowerCase()),
            );
            if (index >= 0) {
              if (!open) show();
              setActive(index);
            }
          }
        }}
      />
      <ChevronDown size={14} className="select-chevron" aria-hidden="true" />
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="listbox"
            aria-label="Auswahlmöglichkeiten"
            className="select-popup"
            style={position}
            onPointerDown={(event) => event.preventDefault()}
          >
            {options.map((option, index) => (
              <div
                key={index}
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.selected}
                aria-disabled={option.disabled || undefined}
                data-index={index}
                className={`select-option ${active === index ? "highlighted" : ""}`}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{option.text}</span>
                {option.selected && <Check size={15} aria-hidden="true" />}
              </div>
            ))}
          </div>,
          ref.current?.closest("dialog") || document.body,
        )}
    </span>
  );
}
