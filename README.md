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

## Bedienung

1. Unter Einstellungen Profile und Wochenpläne anlegen. Ein Plan verteilt die Wochenstunden gleichmäßig auf die gewählten Tage und gilt ab seinem Datum.
2. Unter Stammdaten Kategorien, Tags, Stundensätze, Kunden und Projekte anlegen. Projekt- und Kundensätze können beim Anlegen hinterlegt werden; der Profilstandard steht in den Einstellungen.
3. Timer sofort starten, Beschreibung und Zuordnungen auch währenddessen setzen. Es läuft nur ein Timer insgesamt.
4. Tatsächliche Tagespause meint die gesamte Pause einschließlich Timerpausen. Nur der zusätzliche Betrag wird anteilig von Arbeitszeiten und deren Wert abgezogen. Geplante Pause meint die noch ausstehende Pause und beeinflusst nur die Feierabendprognose.
5. Verlauf und Statistik nach Zeitraum und Zuordnung filtern; CSV exportiert diese Auswahl. Sollzeit bleibt bei Zuordnungsfiltern die vollständige Profil-Sollzeit.
6. Vollständige JSON-Sicherungen regelmäßig extern aufbewahren. CSV ist ein Austauschformat, keine vollständige Sicherung.

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
