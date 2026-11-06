import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { DateTime } from "luxon";
type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  dateTime?: boolean;
  onValueChange?: (value: string) => void;
};
export function germanDate(iso: string) {
  return DateTime.fromISO(iso, { zone: "Europe/Berlin" })
    .setLocale("de-DE")
    .toFormat("dd.MM.yyyy");
}
export function parseGermanInput(text: string, dateTime = false) {
  const pattern = dateTime
    ? /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}(?::\d{2})?$/
    : /^\d{2}\.\d{2}\.\d{4}$/;
  if (!pattern.test(text)) return null;
  const format = dateTime
    ? text.length === 16
      ? "dd.MM.yyyy HH:mm"
      : "dd.MM.yyyy HH:mm:ss"
    : "dd.MM.yyyy";
  const parsed = DateTime.fromFormat(text, format, {
    locale: "de-DE",
    zone: "Europe/Berlin",
  });
  return parsed.isValid && parsed.toFormat(format) === text ? parsed : null;
}
export default function GermanDateInput({
  value,
  defaultValue,
  dateTime = false,
  onValueChange,
  name,
  ...props
}: Props) {
  const format = dateTime ? "dd.MM.yyyy HH:mm:ss" : "dd.MM.yyyy";
  const display = (v: string) =>
    v && DateTime.fromISO(v).isValid
      ? DateTime.fromISO(v, { zone: "Europe/Berlin" })
          .setLocale("de-DE")
          .toFormat(format)
      : "";
  const [text, Text] = useState(() => display(value ?? defaultValue ?? "")),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== undefined) Text(display(value));
  }, [value, dateTime]);
  const parsed = parseGermanInput(text, dateTime);
  const valid = !!parsed?.isValid;
  const iso = valid
    ? parsed!.toFormat(dateTime ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd")
    : "";
  useEffect(() => {
    input.current?.setCustomValidity(
      text && !valid
        ? `Bitte ${dateTime ? "Datum und Uhrzeit als TT.MM.JJJJ HH:mm" : "ein Datum als TT.MM.JJJJ"} eingeben.`
        : "",
    );
  }, [text, valid, dateTime]);
  return (
    <>
      <input
        {...props}
        ref={input}
        type="text"
        lang="de-DE"
        placeholder={dateTime ? "TT.MM.JJJJ HH:mm" : "TT.MM.JJJJ"}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          Text(next);
          const dt = parseGermanInput(next, dateTime);
          if (dt?.isValid)
            onValueChange?.(
              dt.toFormat(dateTime ? "yyyy-MM-dd'T'HH:mm:ss" : "yyyy-MM-dd"),
            );
          else if (!next) onValueChange?.("");
        }}
      />
      {name && <input type="hidden" name={name} value={iso} />}
    </>
  );
}
