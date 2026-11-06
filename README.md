# TecTracker

Lokale Zeiterfassung für Windows und macOS mit Profilen, Arbeitszeitplänen, Pausen, Kategorien, Tags, Projekten, Kunden und Stundensätzen in EUR.

## Starten

Voraussetzung: Node.js 22 oder neuer.

```sh
npm ci
npm run dev
```

Die Vorschau öffnet sich unter http://127.0.0.1:1420. Im Browser werden Daten ausschließlich im lokalen Browserspeicher abgelegt; die Desktop-App verwendet SQLite im Benutzer-App-Verzeichnis. Die beiden Speicher sind voneinander unabhängig. Für einen Umzug die JSON-Sicherung verwenden.

## Web-Version für Docker und Portainer

Die Web-Version verwendet dieselbe Oberfläche und Fachlogik wie die Desktop-App.
Das mehrstufige `Dockerfile` erstellt die Web-Dateien und liefert sie mit Nginx
ohne Root-Rechte auf Container-Port **8080** aus. Rust wird dafür nicht benötigt.
Der Container enthält einen Healthcheck und kann mit schreibgeschütztem Dateisystem laufen.

### Automatisches Image aus GitHub Actions

Der gemeinsame Workflow `.github/workflows/build.yml` baut Windows, macOS und
das Docker-Image. Der Docker-Job testet die App und veröffentlicht
bei einem Push auf den Hauptbranch das Web-Image in der GitHub Container Registry:

```text
ghcr.io/tekocloud/tectracker:latest
```

Ein gemeinsames Image unterstützt **Linux amd64 und arm64**. Jeder Lauf veröffentlicht
zusätzlich einen `sha-<vollständige-Commit-ID>`-Tag, mit dem sich ein bestimmter
Stand gezielt bereitstellen lässt.
`latest` folgt ausschließlich dem Hauptbranch. Der Workflow lässt sich auch manuell
unter **Actions → Desktop and Docker builds → Run workflow** auf dem Hauptbranch starten.
Builds von anderen Branches veröffentlichen kein Image. Der Docker-Job läuft nach
der Versionsprüfung parallel zu den Desktop-Builds; ein macOS-Runner-Ausfall
blockiert die Veröffentlichung des Docker-Images nicht.

Zum Hochladen verwendet die Action das vorhandene `GITHUB_TOKEN` mit
`packages: write`; ein zusätzliches Secret ist nicht erforderlich. Das Image wird
über seine Metadaten mit dem Repository verknüpft und erscheint unter **Packages**.
GitHub legt neue Container-Pakete zunächst privat an. Für einen Download ohne
Anmeldung nach der ersten Veröffentlichung in den **Package settings → Change
visibility → Public** wählen. Alternativ in Portainer eine Registry für `ghcr.io`
mit einem GitHub-Benutzernamen und einem Token mit `read:packages` hinterlegen.

### Image bei Bedarf lokal erstellen

Im Projektverzeichnis auf dem Docker-Rechner ausführen:

```sh
docker build -t tectracker-web:local .
```

Wenn Portainer einen anderen Docker-Rechner verwaltet, muss das Image dort
verfügbar sein. Entweder über eine eigene Registry verteilen oder als Datei übertragen:

```sh
docker save -o tectracker-web.tar tectracker-web:local
# Datei auf den Zielrechner übertragen und dort ausführen:
docker load -i tectracker-web.tar
```

Ein lokal erstelltes Image passt zur Architektur des Build-Rechners. Bei einem
anderen Zielsystem explizit für dessen Architektur erstellen, beispielsweise
`docker buildx build --platform linux/amd64 --load -t tectracker-web:local .`
für einen x64-Server oder entsprechend `linux/arm64` für einen ARM64-Server.

### In Portainer ausführen (Docker Standalone)

1. Den erfolgreichen GitHub-Workflow abwarten und das Paket öffentlich freigeben
   oder die GHCR-Zugangsdaten in Portainer hinterlegen.
2. Unter **Stacks → Add stack → Web editor** den Inhalt von `compose.portainer.yml` einfügen.
3. Optional die Stack-Umgebungsvariable `TECTRACKER_PORT` setzen (Standard: `8080`).
   Standardmäßig wird `ghcr.io/tekocloud/tectracker:latest` verwendet.
   Für eine bestimmte Version `TECTRACKER_IMAGE` auf den vollständigen Image-Namen
   einschließlich SHA-Tag setzen. Für ein lokal gebautes Image
   stattdessen `TECTRACKER_IMAGE=tectracker-web:local` verwenden.
4. **Deploy the stack** wählen und `http://SERVER-IP:8080` öffnen
   beziehungsweise den eingestellten Host-Port verwenden.

Für Updates mit `latest` in Portainer den Stack aktualisieren und dabei das Image
erneut herunterladen lassen (**Re-pull image and redeploy**).

Der Stack verwendet ein schreibgeschütztes Dateisystem und ein temporäres `/tmp`.
Es wird kein Daten-Volume benötigt, weil die Arbeitsdaten im Browser liegen.
Für eine öffentliche Bereitstellung HTTPS über einen vorgeschalteten Reverse Proxy verwenden.
Der Proxy leitet an Container-Port 8080 weiter; die Anwendung wird unter `/` bereitgestellt.

### Daten und Sicherungen

**Die Web-Version speichert ausschließlich im lokalen Browserspeicher.** Der
Container stellt die App bereit und speichert keine Zeiterfassungsdaten. Andere
Browser, Geräte und Browserprofile haben jeweils eigene Daten; eine gemeinsame
Datenbank, Anmeldung oder Synchronisation ist nicht enthalten. Browserdaten
löschen entfernt auch die dort gespeicherten Arbeitsdaten. Regelmäßig unter
Einstellungen eine vollständige JSON-Sicherung herunterladen.

Ein Container-Update erhält die Browserdaten, sofern Adresse, Protokoll und Port
gleich bleiben. Beim Wechsel von HTTP auf HTTPS, auf eine andere Domain oder
einen anderen Port vorher JSON exportieren und anschließend wieder importieren.
Auch Daten der Desktop-App lassen sich über diese JSON-Sicherung übernehmen.
Ein laufender Timer verwendet gespeicherte Zeitpunkte und läuft rechnerisch nach
dem Schließen des Tabs weiter; Desktop-Tray-Funktionen stehen im Web nicht zur Verfügung.

## Desktop-App

Zusätzlich Rust stable installieren. Windows benötigt die Microsoft C++ Build Tools inklusive Windows SDK und WebView2; macOS benötigt Xcode Command Line Tools.

```sh
npm run tauri dev
npm run tauri build
```

Das Fenster schließt in den Tray bzw. die Menüleiste. Dort lässt sich der Timer steuern und die App ausdrücklich beenden. Zeit läuft über Ruhemodus und App-Neustart hinweg weiter, bis der Eintrag beendet oder korrigiert wird.

Installer liegen unter `src-tauri/target/release/bundle`. Die GitHub-Actions-Konfiguration baut Windows x64 sowie macOS ARM64 (Apple Silicon) auf den jeweiligen Plattformen. Signierte Veröffentlichungen sind noch nicht eingerichtet: dafür werden Windows-Signatur und Apple Developer ID einschließlich Notarisierungszugang benötigt. Die Windows-Buildwerkzeuge und Rust sind eingerichtet. Der Windows-x64-Installer wurde erfolgreich gebaut und die native App mit Start/Stopp und SQLite-Speicherung geprüft. macOS-Pakete und Notarisierung benötigen einen macOS-Runner.

## macOS: Meldung „App ist beschädigt“

Die macOS-Pakete verwenden eine lokale Ad-hoc-Signatur für das vollständige App-Bundle. Der Release-Workflow prüft diese Signatur vor dem Hochladen mit `codesign --verify --deep --strict`. Eine Ad-hoc-Signatur bestätigt keine Entwickleridentität und ersetzt keine Apple-Notarisierung. Bei Downloads kann macOS daher weiterhin eine manuelle Freigabe verlangen. Für eine reguläre Veröffentlichung ohne diese Hürde sind ein Developer-ID-Zertifikat und die Notarisierung erforderlich.

Das macOS-ARM64-Paket von Version 0.2.5 enthält lediglich die vom Linker erzeugte Signatur der ausführbaren Datei. Die Prüfung des vollständigen App-Bundles schlägt mit `code has no resources but signature indicates they must be present` fehl. Dieses Paket kann deshalb als „beschädigt“ abgewiesen werden.

Für eine lokale Reparatur dieser eigenen, vertrauenswürdigen Version zuerst `TecTracker.app` aus der DMG nach `/Applications` kopieren. Anschließend im Terminal:

```sh
codesign --force --deep --sign - /Applications/TecTracker.app
codesign --verify --deep --strict --verbose=2 /Applications/TecTracker.app
```

Falls macOS die heruntergeladene App danach weiterhin blockiert, lässt sich ausschließlich deren Download-Quarantäne entfernen:

```sh
xattr -dr com.apple.quarantine /Applications/TecTracker.app
```

Dies gibt genau diese App lokal frei und ist nur für die eigene, vertrauenswürdige Kopie gedacht. Die systemweiten Sicherheitseinstellungen bleiben erhalten. Die Reparatur erfordert keinen Neubau und verändert keine gespeicherten TecTracker-Daten.

## GitHub Releases

Ein Push auf den Hauptbranch (aktuell `master`) veröffentlicht die Installer automatisch unter [Releases](https://github.com/tekocloud/tectracker/releases). Der Workflow liest die Version aus der App und erstellt den Versions-Tag selbst. Für die aktuelle Version **0.1.2** genügt nach dem Commit:

```sh
git push origin HEAD
```

Die Versionen in `package.json`, `src-tauri/Cargo.toml` und `src-tauri/tauri.conf.json` müssen übereinstimmen. Die Oberfläche übernimmt ihre Version direkt aus `package.json`. Explizite Versions-Tags bleiben möglich und müssen zu dieser Version passen.

Für künftige Versionsänderungen diesen Befehl verwenden, damit alle drei Manifeste und beide Lockdateien gemeinsam aktualisiert werden:

```sh
npm run version:set -- 0.2.3
```

Ohne Versionsargument gleicht `npm run version:set` die anderen Dateien auf die bereits in `package.json` eingetragene Version ab. Anschließend alle geänderten Versionsdateien zusammen committen und pushen. Abhängigkeiten werden dabei nicht aktualisiert.

Erst wenn beide Desktop-Builds erfolgreich sind, erstellt der Release-Job den Tag am gebauten Commit und einen Release-Entwurf, lädt die `.exe`-, `.msi`- und `.dmg`-Installer hoch und veröffentlicht das Release. Versionen mit einem Suffix wie `0.1.2-beta.1` werden als Vorabversion markiert. Andere Branches erzeugen ausschließlich Actions-Artefakte. Ein manueller Lauf über „Run workflow“ veröffentlicht ebenfalls, wenn der Hauptbranch oder ein passender Versions-Tag als Referenz ausgewählt ist.

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

Unter dem Tagesfortschritt zeigt die Zeiterfassung zusätzlich den Wochenfortschritt des ausgewählten Profils (Montag bis Sonntag). Er verwendet Nettozeiten einschließlich des laufenden Timers und das vollständige Wochenziel nach Abzug von Urlaub, Krankheit und freien Tagen. Angezeigt werden Zeitraum, Prozent, Ist-/Sollzeit und die verbleibende Zeit; nach Erreichen des Ziels wird zusätzliche Zeit gesondert ausgewiesen.

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
