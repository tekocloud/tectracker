import { useState } from "react";
import {
  Clock3,
  SlidersHorizontal,
  History,
  CalendarDays,
  Wallet,
} from "lucide-react";
import { DateTime } from "luxon";
import { duration, type Profile, type State } from "./core";
import { overtime, parseHours } from "./overtime";
import GermanDateInput, { germanDate } from "./GermanDateInput";
import Modal from "./Modal";
import { useDialogs } from "./Dialogs";

export function OvertimeCard({
  s,
  p,
  now,
  open,
}: {
  s: State;
  p: Profile;
  now: number;
  open: () => void;
}) {
  const result = overtime(s, p, now);
  return (
    <section className="card padded overtime-summary">
      <div className="overtime-title">
        <Clock3 size={18} />
        <h2>Überstunden</h2>
      </div>
      {result ? (
        <>
          <strong className="overtime-balance">
            {duration(result.balance)}
          </strong>
          <p>
            Kontostand bis gestern · Heute voraussichtlich:{" "}
            {duration(result.preview)}
          </p>
        </>
      ) : (
        <p>Richte dein monatsübergreifendes Überstundenkonto ein.</p>
      )}
      <button className="secondary" onClick={open}>
        {result ? "Überstunden ansehen" : "Überstundenkonto einrichten"}
      </button>
    </section>
  );
}

export default function OvertimePanel({
  s,
  p,
  now,
  commit,
}: {
  s: State;
  p: Profile;
  now: number;
  commit: (s: State) => void;
}) {
  const { confirm } = useDialogs();
  const result = overtime(s, p, now);
  const today = DateTime.fromMillis(now, { zone: p.zone }).toISODate()!;
  const yesterday = DateTime.fromISO(today, { zone: p.zone })
    .minus({ days: 1 })
    .toISODate()!;
  const first = s.entries
    .filter((e) => e.profileId === p.id && !e.deleted)
    .map((e) => DateTime.fromISO(e.start).setZone(p.zone).toISODate()!)
    .sort()[0];
  const [from, setFrom] = useState(first && first < today ? first : today);
  const [opening, setOpening] = useState("0:00");
  const [dialog, setDialog] = useState(false);
  const [date, setDate] = useState(yesterday);
  const [value, setValue] = useState("0:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const update = (account: NonNullable<Profile["overtime"]>) =>
    commit({
      ...s,
      profiles: s.profiles.map((profile) =>
        profile.id === p.id ? { ...profile, overtime: account } : profile,
      ),
    });
  const selected = result?.days.find((day) => day.date === date);
  let desired: number | null = null;
  try {
    desired = parseHours(value);
  } catch {
    /* Input may be incomplete. */
  }
  if (!result || !p.overtime)
    return (
      <section className="card padded overtime-setup">
        <div className="overtime-title">
          <span className="overtime-symbol">
            <Wallet size={21} />
          </span>
          <h2>Überstundenkonto einrichten</h2>
        </div>
        <p>
          Der Anfangssaldo gilt zu Beginn des Startdatums. Danach zählen
          Nettoarbeitszeit und Sollzeit, auch an Tagen ohne Einträge.
        </p>
        <form
          className="overtime-setup-form"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
                !DateTime.fromISO(from).isValid ||
                from > today
              )
                throw Error("Bitte ein gültiges Startdatum bis heute wählen.");
              update({
                from,
                openingSeconds: parseHours(opening),
                corrections: [],
              });
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Startdatum
            <GermanDateInput required value={from} onValueChange={setFrom} />
          </label>
          <label>
            Anfangssaldo (Stunden:Minuten)
            <input
              required
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="12:30 oder -2:15"
            />
          </label>
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <button className="primary">Überstundenkonto speichern</button>
        </form>
      </section>
    );
  const account = p.overtime;
  return (
    <>
      <div className="metrics overtime-metrics">
        <section className="card metric accent">
          <div>KONTOSTAND</div>
          <strong>{duration(result.balance)}</strong>
          <small>Abgeschlossene Tage · bis {germanDate(yesterday)}</small>
        </section>
        <section className="card metric">
          <div>HEUTE VORAUSSICHTLICH</div>
          <strong>{duration(result.preview)}</strong>
          <small>Live-Vorschau mit vollständiger Tagessollzeit</small>
        </section>
        <section className="card metric">
          <div>ANFANGSSALDO</div>
          <strong>{duration(account.openingSeconds)}</strong>
          <small>Kontobeginn am {germanDate(account.from)}</small>
        </section>
      </div>
      <section className="card overtime-months">
        <div className="table-heading overtime-heading">
          <div>
            <div className="overtime-title">
              <CalendarDays size={18} />
              <h2>Monatsübersicht</h2>
            </div>
            <p>Arbeitszeitsaldo und Korrekturen im Monatsverlauf.</p>
          </div>
          <button
            className="secondary"
            disabled={account.from > yesterday}
            onClick={() => {
              setError("");
              setDialog(true);
            }}
          >
            <SlidersHorizontal size={15} /> Saldo anpassen
          </button>
        </div>
        <div
          className="overtime-table-scroll"
          role="region"
          aria-label="Monatsübersicht"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Monat</th>
                <th scope="col">Arbeitszeitsaldo</th>
                <th scope="col">Korrekturen</th>
                <th scope="col">Kontostand</th>
              </tr>
            </thead>
            <tbody>
              {[...result.months].reverse().map((month) => (
                <tr key={month.month}>
                  <td>
                    {DateTime.fromISO(month.month + "-01")
                      .setLocale("de")
                      .toFormat("LLLL yyyy")}
                    {month.month === today.slice(0, 7) ? " · bis gestern" : ""}
                  </td>
                  <td>{duration(month.change)}</td>
                  <td>{duration(month.adjustment)}</td>
                  <td>
                    <strong>{duration(month.balance)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result.months.length && (
          <div className="empty">
            <CalendarDays size={25} />
            <h3>Noch keine abgeschlossenen Tage vorhanden.</h3>
            <p>
              Nach dem ersten abgeschlossenen Tag erscheint hier dein
              Monatsverlauf.
            </p>
          </div>
        )}
        <p className="overtime-footnote">
          Der Kontostand umfasst abgeschlossene Tage. Heute wird als
          Live-Vorschau einschließlich der vollständigen Tagessollzeit
          angezeigt.
        </p>
      </section>
      <section className="card overtime-history">
        <div className="table-heading overtime-heading">
          <div>
            <div className="overtime-title">
              <History size={18} />
              <h2>Korrekturverlauf</h2>
            </div>
            <p>Manuelle Anpassungen deines Überstundenkontos.</p>
          </div>
          <span className="overtime-count">
            {account.corrections.length}{" "}
            {account.corrections.length === 1 ? "Anpassung" : "Anpassungen"}
          </span>
        </div>
        {!account.corrections.length && (
          <div className="empty">
            <History size={25} />
            <h3>Noch keine Saldoanpassungen vorhanden.</h3>
            <p>
              Auszahlungen oder übernommene Salden kannst du über „Saldo
              anpassen“ eintragen.
            </p>
          </div>
        )}
        {[...account.corrections]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((c) => (
            <div className="overtime-correction" key={c.date}>
              <strong>{germanDate(c.date)}</strong>
              <span>
                Gesetzter Stand: {duration(c.seconds)} · Änderung:{" "}
                {duration(
                  result.days.find((d) => d.date === c.date)?.adjustment || 0,
                )}
                {c.reason && ` · ${c.reason}`}
              </span>
              <button
                className="text-button danger"
                onClick={async () => {
                  if (
                    await confirm(
                      "Saldoanpassung löschen? Der Kontostand wird neu berechnet.",
                    )
                  )
                    update({
                      ...account,
                      corrections: account.corrections.filter(
                        (x) => x.date !== c.date,
                      ),
                    });
                }}
              >
                Korrektur löschen
              </button>
            </div>
          ))}
      </section>
      {dialog && (
        <Modal title="Saldo anpassen" onClose={() => setDialog(false)}>
          <form
            className="modal overtime-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                if (!selected)
                  throw Error(
                    "Bitte einen abgeschlossenen Tag innerhalb des Überstundenkontos wählen.",
                  );
                const seconds = parseHours(value);
                update({
                  ...account,
                  corrections: [
                    ...account.corrections.filter((c) => c.date !== date),
                    { date, seconds, reason: reason.trim() },
                  ],
                });
                setDialog(false);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <h2>Saldo anpassen</h2>
            <label>
              Stichtag
              <GermanDateInput required value={date} onValueChange={setDate} />
            </label>
            <p>
              Gültig zum Tagesende, vom {germanDate(account.from)} bis{" "}
              {germanDate(yesterday)}. Ein vorhandener Wert dieses Tages wird
              ersetzt.
            </p>
            <p>
              Bisheriger Stand: {selected ? duration(selected.balance) : "–"}
            </p>
            <label>
              Gewünschter Stand (Stunden:Minuten)
              <input
                required
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => setValue("0:00")}
            >
              Auf null setzen
            </button>
            <p>
              Veränderung:{" "}
              {selected && desired !== null
                ? duration(desired - selected.balance)
                : "–"}
            </p>
            <label>
              Grund (optional)
              <input
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p>
              Der gesetzte Stand bleibt auch bei späteren Änderungen älterer
              Arbeitszeiten bestehen.
            </p>
            {error && (
              <p className="alert" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDialog(false)}
              >
                Abbrechen
              </button>
              <button className="primary">Saldo speichern</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
