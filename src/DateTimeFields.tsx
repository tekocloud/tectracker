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
}: {
  label: string;
  value: string;
  required: boolean;
  onValueChange: (value: string) => void;
}) {
  const [values, setValues] = useState(() => parts(value));
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => setValues(parts(value)), [value]);
  const normalized = values.map((v, i) => v.padStart(fields[i][2], "0"));
  const parsed = values.every(Boolean)
    ? parseGermanInput(
        `${normalized[0]}.${normalized[1]}.${normalized[2]} ${normalized[3]}:${normalized[4]}:${normalized[5]}`,
        true,
      )
    : null;
  useEffect(() => {
    first.current?.setCustomValidity(
      values.some(Boolean) && !parsed
        ? "Bitte ein vollständiges, gültiges Datum mit Uhrzeit eingeben."
        : "",
    );
  }, [values, !!parsed]);

  return (
    <fieldset className="datetime-fields">
      <legend>{label}</legend>
      <div className="datetime-parts">
        {fields.map(([name, placeholder, length], index) => (
          <label key={name}>
            {name}
            <input
              ref={index === 0 ? first : undefined}
              aria-label={`${label} ${name}`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={placeholder}
              maxLength={length}
              pattern={`[0-9]{1,${length}}`}
              required={required || values.some(Boolean)}
              value={values[index]}
              onFocus={(event) => event.currentTarget.select()}
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
                if (date) onValueChange(date.toFormat("yyyy-MM-dd'T'HH:mm:ss"));
              }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
