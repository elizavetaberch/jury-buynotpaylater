/**
 * Jury-Bewertung „Buy not, pay later" – Google Apps Script Web App
 * ---------------------------------------------------------------
 * Empfängt JSON-Posts aus index.html und schreibt pro Konzept eine
 * Zeile in das Tab "Antworten". Baut Tab "Auswertung" mit Durchschnitt
 * je Konzept + Ranking als Formeln neu auf.
 *
 * Einrichtung:
 *   1) Google Sheet öffnen → Erweiterungen → Apps Script.
 *   2) Diesen Code in Code.gs einfügen, speichern.
 *   3) Bereitstellen → Neue Bereitstellung → Typ "Web-App"
 *        Ausführen als: ich
 *        Zugriff:       Alle (auch anonym)
 *      → /exec-URL kopieren und in index.html als SCRIPT_URL eintragen.
 */

const SHEET_NAME    = "Antworten";    // Rohdaten, pro Konzept eine Zeile
const SUMMARY_NAME  = "Auswertung";   // Aggregat pro Konzept

// Kriterien-Reihenfolge MUSS zur Reihenfolge im HTML passen.
const CRITERIA = [
  {key:"kreativ",    label:"Kreativität & Innovationsgrad", weight:30},
  {key:"ziel",       label:"Zielgruppenwirkung",            weight:30},
  {key:"machbar",    label:"Machbarkeit",                   weight:20},
  {key:"medien",     label:"Medienadäquate Umsetzung",      weight:15},
  {key:"wirtschaft", label:"Wirtschaftlichkeit",             weight: 5}
];

// =============== HTTP-Endpunkte ===============

function doPost(e){
  try{
    if(!e || !e.postData || !e.postData.contents){
      return jsonOut({ok:false, error:"Leerer Request"});
    }
    const data = JSON.parse(e.postData.contents);

    if(!data.jurymitglied || !String(data.jurymitglied).trim()){
      return jsonOut({ok:false, error:"Name des Jurymitglieds fehlt"});
    }
    if(!Array.isArray(data.konzepte) || data.konzepte.length === 0){
      return jsonOut({ok:false, error:"Keine Konzepte übermittelt"});
    }

    // Sperre gegen parallele Schreibvorgänge.
    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);

    try{
      const ss    = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = getOrCreateAnswerSheet(ss);
      const ts    = new Date();

      const rows = data.konzepte.map(k => [
        ts,
        String(data.jurymitglied).trim(),
        data.datum || "",
        Number(k.nr) || "",
        String(k.name || ("Konzept " + k.nr)),
        ...CRITERIA.map(c => numOr0(k.punkte && k.punkte[c.key])),
        k.gesamt != null ? Number(k.gesamt) : "",
        String(k.anmerkungen || "")
      ]);

      sheet.getRange(sheet.getLastRow()+1, 1, rows.length, rows[0].length)
           .setValues(rows);

      rebuildSummary(ss);

      return jsonOut({ok:true, gespeichert: rows.length});
    } finally {
      lock.releaseLock();
    }
  } catch(err){
    return jsonOut({ok:false, error: String(err && err.message || err)});
  }
}

function doGet(){
  return ContentService
    .createTextOutput("Jury-Endpoint aktiv. POST mit Content-Type text/plain;charset=utf-8 senden.")
    .setMimeType(ContentService.MimeType.TEXT);
}

// =============== Helfer ===============

function jsonOut(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function numOr0(v){
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function headerRow(){
  return [
    "Zeitstempel","Jurymitglied","Datum","Konzept-Nr","Konzept-Name",
    ...CRITERIA.map(c => `${c.label} (${c.weight}%)`),
    "Gesamtpunkte","Anmerkungen"
  ];
}

function getOrCreateAnswerSheet(ss){
  let s = ss.getSheetByName(SHEET_NAME);
  if(!s){
    s = ss.insertSheet(SHEET_NAME);
    s.appendRow(headerRow());
    s.setFrozenRows(1);
    s.getRange(1,1,1,headerRow().length).setFontWeight("bold");
  }
  return s;
}

function columnLetter(n){
  let s = "";
  while(n > 0){
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// =============== Auswertungs-Tab ===============
// Spalten in "Antworten":
//   A Zeitstempel | B Juror | C Datum | D Nr | E Name
//   F..J  fünf Kriterien | K Gesamtpunkte | L Anmerkungen
function rebuildSummary(ss){
  let s = ss.getSheetByName(SUMMARY_NAME);
  if(!s) s = ss.insertSheet(SUMMARY_NAME);
  s.clearContents();

  const header = [
    "Konzept-Nr","Konzept-Name","Anzahl Bewertungen",
    ...CRITERIA.map(c => "Ø " + c.label),
    "Ø Gesamt","Rang"
  ];
  s.appendRow(header);
  s.setFrozenRows(1);
  s.getRange(1,1,1,header.length).setFontWeight("bold");

  const A = SHEET_NAME;
  const firstCritCol = 6;                  // F
  const totalCol     = firstCritCol + CRITERIA.length; // K = 11

  for(let nr = 1; nr <= 6; nr++){
    const row = nr + 1;
    s.getRange(row, 1).setValue(nr);

    // Erster gefundener Konzept-Name aus den Antworten:
    s.getRange(row, 2).setFormula(
      `=IFERROR(INDEX(FILTER(${A}!E:E, ${A}!D:D=${nr}), 1), "Konzept ${nr}")`);

    // Anzahl Bewertungen für dieses Konzept:
    s.getRange(row, 3).setFormula(`=COUNTIF(${A}!D:D, ${nr})`);

    // Ø je Kriterium:
    for(let c = 0; c < CRITERIA.length; c++){
      const srcCol = columnLetter(firstCritCol + c);
      s.getRange(row, 4 + c).setFormula(
        `=IFERROR(AVERAGEIF(${A}!D:D, ${nr}, ${A}!${srcCol}:${srcCol}), "")`);
    }

    // Ø Gesamtpunkte:
    const totalLetter = columnLetter(totalCol);
    const avgTotalColHere = 4 + CRITERIA.length; // Spalte i.d. Auswertung
    s.getRange(row, avgTotalColHere).setFormula(
      `=IFERROR(AVERAGEIF(${A}!D:D, ${nr}, ${A}!${totalLetter}:${totalLetter}), "")`);

    // Rang (1 = beste Bewertung):
    const avgTotalLetter = columnLetter(avgTotalColHere);
    s.getRange(row, avgTotalColHere + 1).setFormula(
      `=IFERROR(RANK(${avgTotalLetter}${row}, ${avgTotalLetter}$2:${avgTotalLetter}$7), "")`);
  }

  s.autoResizeColumns(1, header.length);
}
