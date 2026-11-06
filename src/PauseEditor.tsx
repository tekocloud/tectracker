import { DateTime } from "luxon";
import DateTimeFields from "./DateTimeFields";
import { Plus, Trash2 } from "lucide-react";
import { duration, type Entry } from "./core";

export default function PauseEditor({
  entry,
  zone,
  onChange,
}: {
  entry: Entry;
  zone: string;
  onChange: (pauses: Entry["pauses"]) => void;
}) {
  const total = entry.pauses.reduce((sum, p) => {
    const a = Date.parse(p.start),
      b = p.end ? Date.parse(p.end) : Date.now();
    return (
      sum +
      (Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, b - a) / 1000 : 0)
    );
  }, 0);
  function add() {
    const start = entry.pauses.at(-1)?.end || entry.start;
    const end = DateTime.fromMillis(
      Math.min(
        Date.parse(start) + 30 * 60000,
        entry.end ? Date.parse(entry.end) : Date.now(),
      ),
    )
      .toUTC()
      .toISO()!;
    onChange([...entry.pauses, { start, end }]);
  }
  return (
    <section className="pause-editor" aria-label="Pausenzeiten">
      <div className="pause-heading">
        <div>
          <h3>Pausenzeiten</h3>
          <p>Pausenzeiten beziehen sich auf den Tag des Arbeitsbeginns.</p>
        </div>
        <button type="button" className="secondary" onClick={add}>
          <Plus size={15} />
          Pause hinzufügen
        </button>
      </div>
      {!entry.pauses.length && (
        <p className="pause-empty">Noch keine Pause eingetragen.</p>
      )}
      {entry.pauses.map((pause, i) => (
        <fieldset className="pause-row" key={i}>
          <legend>Pause {i + 1}</legend>
          <div className="pause-inputs">
            {(["start", "end"] as const).map((k) => (
              <div key={k}>
                <DateTimeFields
                  label={`Pause ${i + 1} ${k === "start" ? "Beginn" : "Ende"}`}
                  timeOnly
                  baseDate={DateTime.fromISO(entry.start)
                    .setZone(zone)
                    .toISODate()!}

                  required={
                    k === "start" || !!entry.end || pause.end !== undefined
                  }
                  value={
                    pause[k] && DateTime.fromISO(pause[k]!).isValid
                      ? DateTime.fromISO(pause[k]!)
                          .setZone(zone)
                          .toFormat("yyyy-MM-dd'T'HH:mm:ss")
                      : ""
                  }
                  onValueChange={(value) => {
                    const day = DateTime.fromISO(entry.start)
                      .setZone(zone)
                      .toISODate();
                    const d = DateTime.fromISO(
                      `${day}T${value.split("T")[1]}`,
                      {
                        zone,
                      },
                    );
                    onChange(
                      entry.pauses.map((p, j) =>
                        j === i
                          ? {
                              ...p,
                              [k]: d.isValid ? d.toUTC().toISO()! : value,
                            }
                          : p,
                      ),
                    );
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="icon danger"
              aria-label={`Pause ${i + 1} entfernen`}
              onClick={() => onChange(entry.pauses.filter((_, j) => j !== i))}
            >
              <Trash2 size={17} />
            </button>
          </div>
          {!pause.end && !entry.end && (
            <small>
              Diese Pause läuft noch. Mit „Bis“ kannst du sie nachträglich
              beenden.
            </small>
          )}
        </fieldset>
      ))}
      {!!entry.pauses.length && (
        <div className="pause-summary">
          <span>Pausen gesamt</span>
          <strong>{duration(total)}</strong>
        </div>
      )}
      <small>
        Die Pausen werden von Arbeitszeit und Zeitwert abgezogen. Sie müssen
        innerhalb des Eintrags liegen und dürfen sich nicht überschneiden.
      </small>
    </section>
  );
}
