# Jury-Bewertung „Buy not, pay later" – Setup-Anleitung

Komplette kostenlose Lösung: **GitHub Pages** hostet das Formular, **Google Apps Script + Sheet** sammelt die Antworten zentral.

Dateien in diesem Ordner:

- `index.html` – Bewertungsformular (statisch, läuft auf GitHub Pages)
- `Code.gs`    – Apps-Script-Code für das Sheet
- `README.md`  – diese Anleitung

---

## A) Google Sheet + Apps Script einrichten

1. **Sheet anlegen:** in Google Drive ein neues Google Sheet erstellen, z. B. **„Jury Buy not, pay later"**.
2. **Apps Script öffnen:** im Sheet → Menü **Erweiterungen → Apps Script**.
3. **Code einfügen:** den vorhandenen `Code.gs`-Inhalt im Editor löschen und den **gesamten Inhalt von `Code.gs` aus diesem Ordner** einfügen. Diskette zum Speichern (⌘/Strg + S). Projekt benennen, z. B. „Jury Endpoint".
4. **(Optional) Kennwort setzen:** ganz oben in `Code.gs`:
   ```js
   const SHARED_PASSWORD = "buy2026";   // leer lassen = ohne Kennwort
   ```
   Den gleichen Wert teilt ihr nur an die Jury (Mail/Slack), nicht öffentlich.
5. **Web-App deployen:** oben rechts **Bereitstellen → Neue Bereitstellung**.
   - Typ wählen: **Web-App**
   - Beschreibung: „Jury Endpoint v1"
   - **Ausführen als:** *Ich* (= dein Google-Konto)
   - **Wer hat Zugriff:** **Alle** (auch anonym — damit jede:r Juror:in posten kann)
   - **Bereitstellen** klicken, beim ersten Mal Google-Berechtigungen erteilen
     (Konto wählen → „Erweitert" → „Zur Seite … (nicht überprüft)" → Zulassen).
6. **/exec-URL kopieren** — sie sieht so aus:
   ```
   https://script.google.com/macros/s/AKfycb…/exec
   ```
   Diese URL ist die `SCRIPT_URL`.

> **Bei späteren Code-Änderungen:** Bereitstellen → **Bereitstellung verwalten** → Stiftsymbol → Version **„Neu"** → Bereitstellen. Die URL bleibt gleich.

---

## B) `SCRIPT_URL` ins HTML eintragen

In `index.html` ganz oben im `<script>`-Block diese Zeile ändern:

```js
const SCRIPT_URL = "DEINE_APPS_SCRIPT_WEBAPP_URL_HIER_EINSETZEN";
```

→ ersetzen durch die soeben kopierte `/exec`-URL.

---

## C) GitHub Pages aktivieren

1. Repo auf GitHub anlegen (z. B. `jury-buynotpaylater`), public.
2. `index.html` ins Repo committen — direkt in den Root, **damit die Seite unter `…/`** erreichbar ist.
   ```bash
   git init
   git add index.html
   git commit -m "Jury-Formular"
   git branch -M main
   git remote add origin git@github.com:<dein-user>/jury-buynotpaylater.git
   git push -u origin main
   ```
3. Auf GitHub: **Settings → Pages**
   - **Source:** Deploy from a branch
   - **Branch:** `main` / `(root)` → Save
4. Nach ~1 Min ist die Seite live unter:
   ```
   https://<dein-user>.github.io/jury-buynotpaylater/
   ```
   Diesen Link bekommt die Jury.

---

## D) Test-Lauf

1. Eigene Seite öffnen, „Name des Jurymitglieds" ausfüllen, ein paar Punkte vergeben, **„Bewertung absenden"** klicken.
2. Erwartete Anzeige: *„Bewertung erfolgreich gespeichert. Vielen Dank!"*
3. Im Sheet erscheint Tab **Antworten** mit 6 neuen Zeilen (1 pro Konzept) und Tab **Auswertung** mit dem aktualisierten Ranking.
4. Bei Fehlern siehe Abschnitt **„Troubleshooting"** unten.

---

## E) Wie es technisch funktioniert (kurz)

- **CORS:** Der Browser sendet POST mit `Content-Type: text/plain;charset=utf-8` und **ohne** custom Header. Damit gilt der Request als *simple request*, kein Preflight (`OPTIONS`) — Apps Script unterstützt das, eigenes Setzen von CORS-Headern ist nicht nötig.
- **Apps Script** liest den Body über `JSON.parse(e.postData.contents)`, schreibt pro Konzept eine Zeile und baut den **Auswertung**-Tab neu auf (Ø je Konzept + Rang via `AVERAGEIF` und `RANK`).
- **localStorage:** das Formular speichert nach jeder Eingabe einen Snapshot lokal im Browser. Schließen + erneut öffnen = alles wieder da. Erst nach Klick auf *„Alle Eingaben löschen"* ist es weg.
- **CSV-Export & Drucken** als Offline-Backup, falls das Apps Script doch mal nicht antwortet — Juror:in kann die CSV per Mail schicken.

---

## F) Datenmodell im Sheet

**Tab `Antworten`** – eine Zeile pro Konzept pro Jurymitglied:

| Spalte | Inhalt |
|---|---|
| A | Zeitstempel (serverseitig) |
| B | Jurymitglied |
| C | Datum |
| D | Konzept-Nr (1–6) |
| E | Konzept-Name |
| F | Kreativität & Innovationsgrad (30%) |
| G | Zielgruppenwirkung (30%) |
| H | Machbarkeit (20%) |
| I | Medienadäquate Umsetzung (15%) |
| J | Wirtschaftlichkeit (5%) |
| K | Gesamtpunkte (gewichtet, 0–5) |
| L | Anmerkungen |

**Tab `Auswertung`** – Aggregat, wird beim Empfang automatisch neu aufgebaut:

- Konzept-Nr, Konzept-Name (erster gefundener)
- Anzahl Bewertungen
- Ø je Kriterium
- Ø Gesamtpunkte
- Rang (1 = höchste Punktzahl)

---

## G) Troubleshooting

| Symptom | Ursache / Fix |
|---|---|
| Browser-Konsole zeigt `CORS preflight`-Fehler | Es wurde doch ein custom Header oder `application/json` gesetzt → in `submitToSheet()` nur `Content-Type: text/plain;charset=utf-8` lassen. |
| Antwort „Falsches oder fehlendes Kennwort" | `SHARED_PASSWORD` in `Code.gs` weicht vom Kennwort-Feld ab. Beide angleichen oder Passwort in `Code.gs` leeren. |
| 403 / „Authorization required" | Beim Deploy unter „Wer hat Zugriff" *Alle* wählen (nicht *Nur ich*). |
| Sheet bleibt leer, aber 200 OK | Falscher Sheet-Tab? `SHEET_NAME` in `Code.gs` und der Tabname im Sheet müssen identisch sein (oder das Skript erstellt den Tab beim ersten POST automatisch). |
| Nach Code-Änderung passiert nichts | **Bereitstellung verwalten → neue Version** veröffentlichen. Sonst läuft weiter die alte Version. |
| Juror sieht „Netzwerkfehler" | Sie:r soll **CSV exportieren** klicken und die Datei zurückschicken. Daten gehen nicht verloren — sind zusätzlich im `localStorage`. |

---

## H) Übergabe an die Jury – Textbaustein

> Liebe Jury,
> bitte bewertet die 6 Konzepte hier:
> **https://<dein-user>.github.io/jury-buynotpaylater/**
> Oben Namen eintragen, pro Konzept 0–5 Punkte je Kriterium, am Ende **„Bewertung absenden"**.
> Kennwort (falls aktiviert): `…`
> Eingaben werden lokal gespeichert — ihr könnt die Seite zwischendurch schließen und später weitermachen.
> Bei Fragen meldet euch bei mir.
