import { DateTime } from "luxon";
import { duration, scheduledTarget, type State, type Day } from "./core";
export function AbsenceTimelineRow({
  state,
  day,
  onRemove,
}: {
  state: State;
  day: Day;
  onRemove: (day: Day) => void;
}) {
  const profile = state.profiles.find((p) => p.id === day.profileId)!;
  return (
    <div className="entry absence-entry">
      <span className="color-dot" />
      <div className="entry-title">
        <strong>{day.absence}</strong>
        <small>{profile.name} · Ganztägige Abwesenheit</small>
      </div>
      <div className="entry-time">
        Ganztägig<small>Keine Arbeitszeit</small>
      </div>
      <div className="entry-total">
        <strong>−{duration(scheduledTarget(profile, day.date))}</strong>
        <small>Sollzeit entfällt</small>
      </div>
      <button
        className="icon danger"
        title={`${day.absence} entfernen`}
        onClick={() => onRemove(day)}
      >
        ×
      </button>
    </div>
  );
}
export default function AbsenceSummary({
  state,
  days,
  onRemove,
}: {
  state: State;
  days: Day[];
  onRemove: (day: Day) => void;
}) {
  return (
    <section className="card absence-summary">
      <div className="table-heading">
        <h2>Abwesenheiten</h2>
        <span className="absence-counts">
          {["Urlaub", "Krankheit", "Frei"].map((kind) => (
            <span key={kind}>
              {kind}:{" "}
              <strong>
                {days.filter((d) => d.absence === kind).length}{" "}
                {days.filter((d) => d.absence === kind).length === 1
                  ? "Tag"
                  : "Tage"}
              </strong>
            </span>
          ))}
        </span>
      </div>
      <p className="muted absence-hint">
        Abwesenheiten setzen die Sollzeit des Tages auf null. Sie zählen nicht
        als erfasste Arbeitszeit und haben keinen Zeitwert. Zuordnungsfilter
        gelten nur für Arbeitszeiten.
      </p>
      {days.length ? (
        <div className="absence-list">
          {[...days]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((d) => {
              const profile = state.profiles.find((p) => p.id === d.profileId)!;
              return (
                <div className="absence-row" key={d.profileId + d.date}>
                  <span className="absence-badge">{d.absence}</span>
                  <strong>
                    {DateTime.fromISO(d.date)
                      .setLocale("de")
                      .toFormat("ccc, dd.MM.yyyy")}
                  </strong>
                  <span>{profile.name}</span>
                  <span>
                    {duration(scheduledTarget(profile, d.date))} Sollzeit
                    entfällt
                  </span>
                  <button
                    className="text-button danger"
                    onClick={() => onRemove(d)}
                  >
                    Entfernen
                  </button>
                </div>
              );
            })}
        </div>
      ) : (
        <p className="pause-empty">
          Keine Abwesenheiten im gewählten Zeitraum.
        </p>
      )}
    </section>
  );
}
