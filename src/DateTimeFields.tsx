import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { parseGermanInput } from "./GermanDateInput";

const fields = [
  ["Tag", "TT", 2],
  ["Monat", "MM", 2],
  ["Jahr", "JJJJ", 4],
  ["Stunde", "hh", 2],
  ["Minute", "mm", 2],
  ["Sekunde", "ss", 2],
] as const;

function parts(value: string) {
  const date = DateTime.fromISO(value, { zone: "Europe/Berlin" });
  return date.isValid
    ? date.toFormat("dd MM yyyy HH mm ss").split(" ")
    : fields.map(() => "");
}

export default function DateTimeFields({
  label,
  value,
  required,
  onValueChange,
  timeOnly = false,
  baseDate = "2000-01-01",
}: {
  label: string;
  value: string;
  required: boolean;
  onValueChange: (value: string) => void;
  timeOnly?: boolean;
  baseDate?: string;
}) {
  const readParts = (text: string) => {
    const result = parts(text);
    return timeOnly
      ? [...parts(baseDate).slice(0, 3), ...result.slice(3)]
      : result;
  };
  const [values, setValues] = useState(() => readParts(value));
  const first = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const timePicker = useRef<HTMLInputElement>(null);
  function openTimePicker() {
    try {
      timePicker.current?.showPicker();
    } catch {
      /* Direct input remains available. */
    }
  }
  function openPicker() {
    try {
      picker.current?.showPicker();
    } catch {
      /* Keyboard input remains available. */
    }
  }
  const emittedValue = useRef(value);
  useEffect(() => {
    // Keep the local draft while the parent echoes our own change back.
    // Otherwise typing the first digit would immediately pad the active field.
    if (value !== emittedValue.current) {
      emittedValue.current = value;
      setValues(readParts(value));
    }
  }, [value]);
  useEffect(() => {
    if (timeOnly)
      setValues((current) => [
        ...parts(baseDate).slice(0, 3),
        ...current.slice(3),
      ]);
  }, [baseDate, timeOnly]);
  const normalized = values.map((v, i) => v.padStart(fields[i][2], "0"));
  const parsed = values.every(Boolean)
    ? parseGermanInput(
        `${normalized[0]}.${normalized[1]}.${normalized[2]} ${normalized[3]}:${normalized[4]}:${normalized[5]}`,
        true,
      )
    : null;
  useEffect(() => {
    first.current?.setCustomValidity(
      (timeOnly ? values.slice(3) : values).some(Boolean) && !parsed
        ? "Bitte ein vollständiges, gültiges Datum mit Uhrzeit eingeben."
        : "",
    );
  }, [values, !!parsed]);

  return (
    <fieldset className="datetime-fields">
      <legend>{label}</legend>
      <div style={{ position: "relative", marginBottom: 8 }}>
        <button
          type="button"
          tabIndex={-1}
          className="text-button"
          aria-label={`${label} Uhrzeit auswählen`}
          onClick={openTimePicker}
        >
          Uhrzeit wählen
        </button>
        <input
          ref={timePicker}
          type="time"
          step="1"
          tabIndex={-1}
          aria-label={`${label} Uhrzeitauswahl`}
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: "none",
          }}
          value={
            values.slice(3).every(Boolean)
              ? values
                  .slice(3)
                  .map((v) => v.padStart(2, "0"))
                  .join(":")
              : ""
          }
          onChange={(event) => {
            if (!event.target.value) return;
            const time =
              event.target.value.length === 5
                ? event.target.value + ":00"
                : event.target.value;
            const next = [...values.slice(0, 3), ...time.split(":")];
            setValues(next);
            const date = parseGermanInput(
              `${next[0].padStart(2, "0")}.${next[1].padStart(2, "0")}.${next[2].padStart(4, "0")} ${time}`,
              true,
            );
            if (date) {
              const nextValue = date.toFormat("yyyy-MM-dd'T'HH:mm:ss");
              emittedValue.current = nextValue;
              onValueChange(nextValue);
            }
          }}
        />
      </div>
      {!timeOnly && (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <button
            type="button"
            tabIndex={-1}
            className="text-button"
            aria-label={`${label} Datum auswählen`}
            onClick={openPicker}
          >
            Kalender öffnen
          </button>
          <input
            ref={picker}
            type="date"
            aria-label={`${label} Kalenderdatum`}
            tabIndex={-1}
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
            value={`${values[2]}-${values[1].padStart(2, "0")}-${values[0].padStart(2, "0")}`}
            onChange={(event) => {
              const chosen = DateTime.fromISO(event.target.value);
              if (!chosen.isValid) return;
              const next = [
                ...chosen.toFormat("dd MM yyyy").split(" "),
                ...values.slice(3),
              ];
              setValues(next);
              const date = DateTime.fromISO(
                `${event.target.value}T${next
                  .slice(3)
                  .map((v) => v.padStart(2, "0"))
                  .join(":")}`,
              );
              if (date.isValid) {
                const nextValue = date.toFormat("yyyy-MM-dd'T'HH:mm:ss");
                emittedValue.current = nextValue;
                onValueChange(nextValue);
              }
            }}
          />
        </div>
      )}
      <div
        className="datetime-parts"
        style={
          timeOnly
            ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }
            : undefined
        }
      >
        {fields.map(([name, placeholder, length], index) =>
          timeOnly && index < 3 ? null : (
            <label key={name}>
              {name}
              <input
                ref={index === (timeOnly ? 3 : 0) ? first : undefined}
                aria-label={`${label} ${name}`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={placeholder}
                maxLength={length}
                pattern={`[0-9]{1,${length}}`}
                required={
                  required ||
                  (timeOnly ? values.slice(3) : values).some(Boolean)
                }
                value={values[index]}
                onFocus={(event) => event.currentTarget.select()}
                onClick={index < 3 ? openPicker : openTimePicker}
                onBlur={() => {
                  setValues((current) =>
                    current.map((part, i) =>
                      i === index && part ? part.padStart(length, "0") : part,
                    ),
                  );
                }}
                onChange={(event) => {
                  const next = [...values];
                  next[index] = event.target.value;
                  setValues(next);
                  const padded = next.map((v, i) =>
                    v.padStart(fields[i][2], "0"),
                  );
                  const date = next.every(Boolean)
                    ? parseGermanInput(
                        `${padded[0]}.${padded[1]}.${padded[2]} ${padded[3]}:${padded[4]}:${padded[5]}`,
                        true,
                      )
                    : null;
                  if (date) {
                    const nextValue = date.toFormat("yyyy-MM-dd'T'HH:mm:ss");
                    emittedValue.current = nextValue;
                    onValueChange(nextValue);
                  }
                }}
              />
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
