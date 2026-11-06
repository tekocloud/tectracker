# TecTracker

Lokale Zeiterfassung für Windows und macOS mit Profilen, Arbeitszeitplänen, Pausen, Kategorien, Tags, Projekten, Kunden und Stundensätzen in EUR.

## Starten

Voraussetzung: Node.js 22 oder neuer.

```sh
npm ci
npm run dev
```

Die Vorschau öffnet sich unter http://127.0.0.1:1420. Im Browser werden Daten ausschließlich im lokalen Browserspeicher abgelegt; die Desktop-App verwendet SQLite im Benutzer-App-Verzeichnis. Die beiden Speicher sind voneinander unabhängig. Für einen Umzug die JSON-Sicherung verwenden.

## Desktop-App

Zusätzlich Rust stable installieren. Windows benötigt die Microsoft C++ Build Tools inklusive Windows SDK und WebView2; macOS benötigt Xcode Command Line Tools.

```sh
npm run tauri dev
npm run tauri build
```

Das Fenster schließt in den Tray bzw. die Menüleiste. Dort lässt sich der Timer steuern und die App ausdrücklich beenden. Zeit läuft über Ruhemodus und App-Neustart hinweg weiter, bis der Eintrag beendet oder korrigiert wird.

Installer liegen unter `src-tauri/target/release/bundle`. Die GitHub-Actions-Konfiguration baut Windows x64 sowie macOS ARM64 und x64 auf den jeweiligen Plattformen. Signierte Veröffentlichungen sind noch nicht eingerichtet: dafür werden Windows-Signatur und Apple Developer ID einschließlich Notarisierungszugang benötigt. Die Windows-Buildwerkzeuge und Rust sind eingerichtet. Der Windows-x64-Installer wurde erfolgreich gebaut und die native App mit Start/Stopp und SQLite-Speicherung geprüft. macOS-Pakete und Notarisierung benötigen einen macOS-Runner.

## GitHub Releases

Ein Push auf den Hauptbranch (aktuell `master`) veröffentlicht die Installer automatisch unter [Releases](https://github.com/tekocloud/tectracker/releases). Der Workflow liest die Version aus der App und erstellt den Versions-Tag selbst. Für die aktuelle Version **0.1.2** genügt nach dem Commit:

```sh
git push origin HEAD
```

Die Versionen in `package.json`, `src-tauri/Cargo.toml` und `src-tauri/tauri.conf.json` müssen übereinstimmen. Die Oberfläche übernimmt ihre Version direkt aus `package.json`. Explizite Versions-Tags bleiben möglich und müssen zu dieser Version passen.

Für künftige Versionsänderungen diesen Befehl verwenden, damit alle drei Manifeste und beide Lockdateien gemeinsam aktualisiert werden:

```sh
npm run version:set -- 0.1.3
```

Ohne Versionsargument gleicht `npm run version:set` die anderen Dateien auf die bereits in `package.json` eingetragene Version ab. Anschließend alle geänderten Versionsdateien zusammen committen und pushen. Abhängigkeiten werden dabei nicht aktualisiert.

Erst wenn alle drei Plattform-Builds erfolgreich sind, erstellt der Release-Job den Tag am gebauten Commit und einen Release-Entwurf, lädt die `.exe`-, `.msi`- und `.dmg`-Installer hoch und veröffentlicht das Release. Versionen mit einem Suffix wie `0.1.2-beta.1` werden als Vorabversion markiert. Andere Branches erzeugen ausschließlich Actions-Artefakte. Ein manueller Lauf über „Run workflow“ veröffentlicht ebenfalls, wenn der Hauptbranch oder ein passender Versions-Tag als Referenz ausgewählt ist.

Das automatische `GITHUB_TOKEN` erhält nur im Release-Job Schreibrechte; ein zusätzliches Token ist nicht nötig. Bereits veröffentlichte Releases werden bei erneuten Läufen unverändert beibehalten; der Schritt endet erfolgreich mit einem Hinweis in der Laufzusammenfassung. Für ein neues Release die App-Version erhöhen und die zugehörigen Lockdateien aktualisieren. Ein fehlgeschlagener Upload kann über einen erneuten Lauf desselben Commits fortgesetzt werden, solange das Release noch ein Entwurf ist. Existierende Tags werden nicht verschoben. Falls Repository- oder Organisationsregeln die Schreibrechte einschränken, müssen diese den Release-Job zulassen.

## Bedienung

1. Unter Einstellungen Profile und Wochenpläne anlegen. Ein Plan verteilt die Wochenstunden gleichmäßig auf die gewählten Tage und gilt ab seinem Datum.
2. Unter Stammdaten Kategorien, Tags, Stundensätze, Kunden und Projekte anlegen. Projekt- und Kundensätze können beim Anlegen hinterlegt werden; der Profilstandard steht in den Einstellungen.
3. Timer sofort starten, Beschreibung und Zuordnungen auch währenddessen setzen. Es läuft nur ein Timer insgesamt.
4. Tatsächliche Tagespause meint die gesamte Pause einschließlich Timerpausen. Nur der zusätzliche Betrag wird anteilig von Arbeitszeiten und deren Wert abgezogen. Geplante Pause meint die noch ausstehende Pause und beeinflusst nur die Feierabendprognose.
5. Verlauf und Statistik nach Zeitraum und Zuordnung filtern; CSV exportiert diese Auswahl. Sollzeit bleibt bei Zuordnungsfiltern die vollständige Profil-Sollzeit.
6. Vollständige JSON-Sicherungen regelmäßig extern aufbewahren. CSV ist ein Austauschformat, keine vollständige Sicherung.

Unter **Zeit nachtragen** gibt es die Eintragsarten Arbeitszeit, Urlaub, Krankheit und Frei. Abwesenheiten brauchen nur ein Datum, erscheinen im Verlauf und in der Statistik und setzen das Tagesziel auf null. Die frühere Abwesenheitseingabe in den Einstellungen ist entfernt; dort erfasste Altdaten bleiben erhalten und sichtbar. Abwesenheiten werden als Tage ausgewiesen und nicht als geleistete Arbeitszeit oder Geldwert gezählt.

Im Verlauf stehen Abwesenheiten direkt unter dem jeweiligen Datum zwischen den Arbeitszeiten. Auch Tage ohne Arbeitszeiteintrag erscheinen. Jede Abwesenheit zeigt die entfallende Sollzeit des Profil-Arbeitszeitplans; in der Statistik bleibt zusätzlich die Übersicht nach Abwesenheitsart erhalten. Die Sollzeit des ausgewählten Zeitraums umfasst den gesamten Zeitraum abzüglich der Abwesenheiten, auch bei geplanten Urlaubstagen. Der Saldo berücksichtigt dagegen nur die bis heute fällige Sollzeit, damit zukünftige Arbeitstage keine Minusstunden erzeugen. Beispiel: 37 Stunden auf fünf Arbeitstage minus ein Urlaubstag von 7:24 Stunden ergeben 29:36 Stunden Wochen-Sollzeit.

Datumsanzeigen und Eingabefelder verwenden unabhängig von der System- oder Browsersprache `TT.MM.JJJJ`, Uhrzeiten das 24-Stunden-Format. Datums-/Zeitfelder können als `TT.MM.JJJJ HH:mm` oder mit Sekunden ausgefüllt werden. Die Anzeige und Eingabe von Zeitpunkten erfolgt in deutscher Ortszeit (Europe/Berlin, einschließlich Sommerzeit). Gespeicherte Zeitpunkte bleiben UTC; CSV- und JSON-Austauschformate bleiben maschinenlesbar.

Im Formular für neue und bestehende Arbeitszeiten lassen sich mit **Pause hinzufügen** mehrere Pausen mit Beginn und Ende nachtragen. Pausen können bearbeitet oder entfernt werden; ihre Summe wird angezeigt. Beim Speichern werden sie chronologisch sortiert. Überschneidende Pausen, Zeiten außerhalb des Eintrags und Pausen ohne positive Dauer werden abgelehnt. Die Nettozeit und ihr Geldwert berücksichtigen alle Pausen; bereits erfasste Timerpausen bleiben erhalten und werden durch den zusätzlichen Tagesabzug nicht doppelt gezählt.

## Berechnung und Architektur

UTC-Zeitpunkte werden für Tagesauswertungen anhand der Profilzeitzone aufgeteilt. Nettozeiten, Pausenverteilung und Geldwerte stammen aus `src/core.ts`. Preise sind ganzzahlige Centbeträge; die Berechnung verwendet ganzzahlige Mikrosekunden und BigInt statt Gleitkomma-Geldberechnung. Jeder Tagesanteil wird auf Cent gerundet. Einträge speichern ihren Preis, sodass spätere Änderungen am Stammsatz historische Werte nicht verändern.

SQLite speichert derzeit den versionierten Anwendungszustand atomar in einer Tabelle mit WAL und voller Schreibsynchronisation. Die Tauri-Schnittstelle stellt `load_state` und `save_state` bereit. Die Fachlogik ist im gemeinsamen TypeScript-Kern gekapselt. Datensätze haben UUIDs; Löschmarkierungen und ein lokales Revisionsjournal bereiten die spätere Synchronisation vor. Ein Synchronisationsprotokoll ist noch nicht implementiert.

CSV unterstützt Spaltenzuordnung, ISO-Zeitpunkte und zwei auswählbare lokale Datumsformate, Zeitzonen, Vorschau und eine atomare Übernahme: bei Fehlern wird nichts importiert. Mehrtägige TecTracker-Exportzeilen mit derselben ID werden zusammengeführt. Fremde CSV-Pausenintervalle und eine exakte Rekonstruktion der ursprünglichen Pausenlage sind nicht Bestandteil des CSV-Formats; JSON erhält diese vollständig.

## Prüfen

```sh
npm test
npm run build
npx playwright install chromium
npx playwright test
```

Alternativ kann `PLAYWRIGHT_CHROME` auf eine vorhandene Chrome-Installation zeigen. Berechnungstests prüfen Sollzeitverteilung, Planhistorie, Abwesenheit, Pausen, Preise, Überschneidungen und Sommerzeit. Bedienungstests prüfen Timer, Browser-Persistenz, Stammdaten und Darstellung. Die native Windows-App wurde gestartet, das Logo geprüft und Start/Stopp mit SQLite-Speicherung getestet. Vollständige Tray-/Dateidialog- und macOS-Tests stehen noch aus.

## Noch offene Ausbauschritte

- macOS-Pakete bauen und prüfen; Signierung und Notarisierung mit echten Zugangsdaten einrichten.
- Stammdaten-Bearbeitung über Dialoge statt der derzeitigen einfachen Eingabefenster verfeinern.
- Zusätzliche Importformate ergänzen.
- Spätere Synchronisation mit Konfliktauflösung implementieren.

Keine Teamverwaltung, Rechnungen, Umsatzsteuer, gesetzlichen Pausenautomaten oder automatischen Feiertage. Die Datenbank ist lokal und nicht zusätzlich verschlüsselt.
