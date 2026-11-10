/**
 * Narrative Builder — Google Apps Script (bound to your narratives Google Doc)
 * Setup: in your Google Doc, Extensions → Apps Script. Paste this into Code.gs,
 * add an HTML file named "Index" with the contents of Index.html, save, then reload the doc.
 * A "Narratives" menu appears. Your work is stored in a file in your Google Drive, in the folder
 * "Narrative Builder data" beside this doc (with an hourly backup copy in its Backups folder), and the
 * doc is rewritten (a few seconds after each change) so it always shows every narrative.
 * Edits typed straight into the doc are never lost: before the doc is written, and whenever the builder
 * loads or checks for changes, each student's text in the doc is compared with what was last written
 * there; one that differs was edited in the doc, and comes into the builder as a hand edit (pullDoc_).
 */

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Narratives')
    .addItem('Open Narrative Builder', 'openBuilder')
    .addToUi();
  try { PropertiesService.getScriptProperties().setProperty('DOC_ID', DocumentApp.getActiveDocument().getId()); } catch (e) {}
}

/* The builder always opens as its latest version, fetched from GitHub Pages, so updates reach this doc
   without pasting anything in again. If that can't be reached, the Index file here is used instead. */
var PAGE_URL = 'https://jakegoldwasser.github.io/narrative-builder/index.html';

function builderHtml_() {
  try {
    var res = UrlFetchApp.fetch(PAGE_URL + '?t=' + Date.now(), { muteHttpExceptions: true });
    var text = res.getResponseCode() === 200 ? res.getContentText() : '';
    if (text.indexOf('Narrative Builder') !== -1) return HtmlService.createHtmlOutput(text);
  } catch (e) {}
  return HtmlService.createHtmlOutputFromFile('Index');
}

/** Opens the builder in a large window over the doc. */
function openBuilder() {
  PropertiesService.getScriptProperties().setProperty('DOC_ID', DocumentApp.getActiveDocument().getId());
  var html = builderHtml_().setWidth(1400).setHeight(900);
  DocumentApp.getUi().showModelessDialog(html, 'Narrative Builder');
}

/** Lets you also run it full-screen in its own tab (Deploy → New deployment → Web app). */
function doGet() {
  return builderHtml_()
    .setTitle('Narrative Builder')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getDoc_() {
  try { var d = DocumentApp.getActiveDocument(); if (d) return d; } catch (e) {}
  var id = PropertiesService.getScriptProperties().getProperty('DOC_ID');
  if (!id) throw new Error('Open the doc once and use Narratives → Open Narrative Builder first.');
  return DocumentApp.openById(id);
}

/** The narratives doc's address, for the builder's "Open the Google Doc" link. */
function getDocUrl() {
  return getDoc_().getUrl();
}

/* ---------------- Where the work is kept ----------------
 * One file, "Narrative Builder data.json", in the folder "Narrative Builder data" beside this doc.
 * Drive keeps that file's earlier versions (Manage versions), and every hour that something is saved
 * (and always just before a student is removed or a backup restored, as things were) a full copy goes
 * into its Backups folder; that copy can be pasted into Backup › Restore from pasted.
 * Nothing in it is ever deleted: a removed student goes to `trash` (Recently removed) and can be put back.
 * The old Script Properties copy (before November 2026) is read once to start the file, and left as it was.
 */
var DATA_NAME = 'Narrative Builder data.json', FOLDER_NAME = 'Narrative Builder data', BACKUPS_NAME = 'Backups';
var BACKUP_EVERY_MS = 60 * 60 * 1000, BACKUPS_KEPT = 500;

function props_() { return PropertiesService.getScriptProperties(); }
function dataFolder_() {
  var sp = props_(), id = sp.getProperty('DATA_FOLDER');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; f.setTrashed(false); return f; } catch (e) {} }
  var parents = DriveApp.getFileById(getDoc_().getId()).getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var found = parent.getFoldersByName(FOLDER_NAME);
  var folder = found.hasNext() ? found.next() : parent.createFolder(FOLDER_NAME);
  sp.setProperty('DATA_FOLDER', folder.getId());
  return folder;
}
function backupsFolder_() {
  var folder = dataFolder_(), found = folder.getFoldersByName(BACKUPS_NAME);
  return found.hasNext() ? found.next() : folder.createFolder(BACKUPS_NAME);
}
function dataFile_() {
  var sp = props_(), id = sp.getProperty('DATA_FILE');
  if (id) { try { var f = DriveApp.getFileById(id); if (f.isTrashed()) f.setTrashed(false); return f; } catch (e) {} }
  var found = dataFolder_().getFilesByName(DATA_NAME);
  if (found.hasNext()) { var g = found.next(); sp.setProperty('DATA_FILE', g.getId()); return g; }
  return null;
}
function emptyData_() { return { settings: {}, order: [], students: {}, rows: {}, trash: {}, rev: 0 }; }
/* The data as last saved. If the file can't be read, this stops with an error rather than starting
   empty, so a save can never write an empty copy over the real one. */
function readData_() {
  var f = dataFile_();
  if (f) {
    var d = JSON.parse(f.getBlob().getDataAsString()); // throws if unreadable: nothing is saved over it
    ['settings', 'students', 'rows', 'trash'].forEach(function (k) { d[k] = d[k] || {}; });
    d.order = d.order || [];
    return d;
  }
  return fromBackupOrOld_();
}
/* No data file (the first time, or it was deleted): start from the newest backup, else the old Script Properties copy. */
function fromBackupOrOld_() {
  var newest = null, files = backupsFolder_().getFiles();
  while (files.hasNext()) { var f = files.next(); if (!newest || f.getDateCreated() > newest.getDateCreated()) newest = f; }
  if (newest) {
    var b = JSON.parse(newest.getBlob().getDataAsString()), d = emptyData_();
    d.settings = b.settings || {};
    (b.students || []).forEach(function (s) { d.students[s.id] = s; d.order.push(s.id); });
    d.rows = b.rows || {}; d.trash = b.trash || {}; d.rev = +b.rev || 0;
    return d;
  }
  var props = props_().getProperties(), old = emptyData_();
  old.order = JSON.parse(props.order || '[]').filter(function (id) { return props['s_' + id]; });
  old.order.forEach(function (id) {
    old.students[id] = JSON.parse(props['s_' + id]);
    if (props['d_' + id]) old.rows[id] = JSON.parse(props['d_' + id]);
  });
  old.settings = JSON.parse(props.settings || '{}');
  old.settings.mine = old.settings.mine || {};
  Object.keys(props).forEach(function (k) { if (k.indexOf('m_') === 0) old.settings.mine[k.slice(2)] = JSON.parse(props[k]); });
  old.rev = +props.rev || 0;
  return old;
}
function backupOf_(d) {
  return { savedAt: new Date().toISOString(), settings: d.settings, rows: d.rows, trash: d.trash, rev: d.rev,
    students: d.order.map(function (id) { return d.students[id]; }).filter(Boolean) };
}
function writeData_(d, backupFirst) {
  var sp = props_(), f = dataFile_();
  var text = JSON.stringify(d);
  if (f) f.setContent(text); else { f = dataFolder_().createFile(DATA_NAME, text, 'application/json'); sp.setProperty('DATA_FILE', f.getId()); }
  sp.setProperty('rev', String(d.rev));
  var last = +(sp.getProperty('LAST_BACKUP') || 0);
  if (backupFirst || Date.now() - last > BACKUP_EVERY_MS) backup_(d);
}
function backup_(d) {
  var tz = Session.getScriptTimeZone(), folder = backupsFolder_();
  folder.createFile('Narratives backup ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH.mm.ss') + '.json', JSON.stringify(backupOf_(d)), 'application/json');
  props_().setProperty('LAST_BACKUP', String(Date.now()));
  // past BACKUPS_KEPT, the oldest go to Drive's trash (where Drive keeps them 30 days more)
  var all = [], files = folder.getFiles();
  while (files.hasNext()) all.push(files.next());
  if (all.length > BACKUPS_KEPT) {
    all.sort(function (a, b) { return a.getDateCreated() - b.getDateCreated(); });
    all.slice(0, all.length - BACKUPS_KEPT).forEach(function (f) { f.setTrashed(true); });
  }
}
function strip_(s) { var o = {}; Object.keys(s).forEach(function (k) { if (k !== 'at' && k !== 'baseAt') o[k] = s[k]; }); return o; }
function trashList_(d) {
  return Object.keys(d.trash).map(function (id) { var t = d.trash[id]; return { id: id, name: t.student.name, removedAt: t.removedAt }; })
    .sort(function (a, b) { return b.removedAt - a.removedAt; });
}

/** Returns everything saved so far as a JSON string. */
function loadState() {
  var d = withLock_(function () { var x = readData_(); if (pullDoc_(x).length) { x.rev = (+x.rev || 0) + 1; writeData_(x, false); } return x; });
  return JSON.stringify({ settings: d.settings, students: d.order.map(function (id) { var s = d.students[id]; if (s) s.baseAt = s.at || 0; return s; }).filter(Boolean),
    trash: trashList_(d), rev: String(d.rev) });
}

/** Changes with every save, so an open builder can tell that another window saved. */
function getRev() {
  try { checkDoc_(); } catch (e) {}
  return props_().getProperty('rev') || '0';
}

/* ---------------- Edits made in the doc ----------------
 * The doc is one section per student: a "Name — Grade N" heading, the narrative's paragraphs, then the
 * word count. writeDoc_ keeps what it wrote for each student in d.docText (and the heading in d.docHead);
 * a section whose text no longer matches was edited in the doc, so it becomes that student's narrative
 * in the builder (`override`, which the page turns into hand edits of just the parts that changed).
 * A blank line between paragraphs is a new paragraph (\n\n); lines with no blank between, like a poem's,
 * stay single lines (\n). */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function norm_(t) {
  return String(t || '').replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function same_(a, b) { return norm_(a).replace(/\s+/g, ' ') === norm_(b).replace(/\s+/g, ' '); }
function wordsOf_(t) { return (String(t || '').trim().match(/\S+/g) || []).length; }
function headingOf_(st) { return (st.name || '(no name)') + ' — Grade ' + st.grade; }
/* Each student's section as it reads in the doc now, by heading. */
function docSections_() {
  var body = getDoc_().getBody(), n = body.getNumChildren(), out = {}, cur = null, lines = null, gap = false;
  var finish = function () { if (cur != null) out[cur] = lines.join('').trim(); };
  for (var i = 0; i < n; i++) {
    var el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH && el.getType() !== DocumentApp.ElementType.LIST_ITEM) continue;
    var p = el.getType() === DocumentApp.ElementType.PARAGRAPH ? el.asParagraph() : el.asListItem();
    var t = p.getText().replace(/\r/g, '\n'), h = el.getType() === DocumentApp.ElementType.PARAGRAPH ? p.getHeading() : null;
    if (h === DocumentApp.ParagraphHeading.HEADING2) { finish(); cur = t.trim(); lines = []; gap = false; continue; }
    if (cur == null) continue;
    if (!t.trim()) { gap = true; continue; }
    if (/^\d+ words( — OVER 200 \(nothing was cut\))?$/.test(t.trim())) continue;
    if (lines.length) lines.push(gap ? '\n\n' : '\n');
    lines.push(t); gap = false;
  }
  finish();
  return out;
}
/* Brings doc edits into d. Returns the ids of the students it changed. */
function pullDoc_(d) {
  var secs;
  try { secs = docSections_(); } catch (e) { return []; }
  d.docText = d.docText || {}; d.docHead = d.docHead || {};
  var changed = [], now = Date.now();
  d.order.forEach(function (id) {
    var st = d.students[id]; if (!st) return;
    var head = d.docHead[id] || headingOf_(st), text = secs[head];
    if (text == null) text = secs[headingOf_(st)];
    if (text == null || text === '(not started)') return;
    var last = d.docText[id] != null ? d.docText[id] : (d.rows[id] ? d.rows[id].text : '');
    if (same_(text, last)) return;
    // edited in the doc: that's the narrative now
    var t = norm_(text);
    st.override = t; st.at = now;
    var r = d.rows[id] || {};
    d.rows[id] = { name: st.name, grade: st.grade, text: t, words: wordsOf_(t), state: wordsOf_(t) > 200 ? 'over' : 'done', at: now };
    d.docText[id] = t;
    changed.push(id);
  });
  props_().setProperty('DOC_CHECKED', String(now));
  return changed;
}
/* Called with the builder's minute-by-minute check: if the doc changed since it was last looked at, bring its edits in. */
function checkDoc_() {
  var sp = props_(), seen = +(sp.getProperty('DOC_CHECKED') || 0);
  var updated = DriveApp.getFileById(getDoc_().getId()).getLastUpdated().getTime();
  if (updated <= seen) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var d = readData_();
    if (pullDoc_(d).length) { d.rev = (+d.rev || 0) + 1; writeData_(d, false); }
  } finally { lock.releaseLock(); }
}
/* Writes the doc from d (after bringing in any edits made there first). */
function syncDoc_(d) {
  var written = writeDoc_(d.order.map(function (id) {
    var r = d.rows[id] || { name: d.students[id].name, grade: d.students[id].grade, text: '', words: 0 };
    r.id = id; return r;
  }));
  d.docText = written.text; d.docHead = written.head;
}

/** The Backups folder's address, for the builder's Backup window. */
function getBackupsUrl() {
  return backupsFolder_().getUrl();
}

/* Saving never loses work, even with the builder open on two computers:
   - a student is only replaced by a copy edited at the same time or later (each copy carries `at`);
   - a student leaves the list only when a window says it was removed, never because a window didn't
     know about it, and then goes to Recently removed rather than being deleted;
   - settings: the newer copy wins, but no saved wording is lost unless it was removed.
   It answers with the students it kept as they were, so that window can load the newer copies. */
function saveState(json) {
  var p = JSON.parse(json);
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var d = readData_();
    var pulled = pullDoc_(d); // edits typed into the doc since it was last written come in first, so this save can't write over them
    var removed = (p.removed || []).filter(function (id) { return d.students[id]; });
    if (removed.length || p.restored) backup_(d); // a copy of everything as it was, before students leave or a backup replaces them
    d.rev = (+d.rev || 0) + 1;
    var gone = function (id) { return removed.indexOf(id) !== -1; };
    var atOf = function (id) { return d.students[id] ? (d.students[id].at || 0) : -1; };
    var kept = [], incoming = {};

    removed.forEach(function (id) {
      d.trash[id] = { student: d.students[id], row: d.rows[id] || null, removedAt: Date.now() };
      delete d.students[id]; delete d.rows[id];
    });
    (p.students || []).forEach(function (s) {
      if (gone(s.id)) return;
      if (d.trash[s.id] && !d.students[s.id] && !p.restored) return; // removed in another window: stays in Recently removed
      var here = d.students[s.id];
      if (here && (here.at || 0) > (s.baseAt || 0)) {
        // changed elsewhere since this window loaded it: the saved copy stays, and if this window changed
        // it too, its copy goes to Recently removed as a second version, so neither edit is lost
        kept.push(s.id);
        if ((s.at || 0) > (s.baseAt || 0) && JSON.stringify(strip_(s)) !== JSON.stringify(strip_(here))) {
          var cid = s.id + '_v' + Date.now(), copy = JSON.parse(JSON.stringify(s));
          copy.id = cid; copy.name = (s.name || '') + ' (version from another window)';
          d.trash[cid] = { student: copy, row: p.rows && p.rows[s.id] || null, removedAt: Date.now() };
        }
        return;
      }
      d.students[s.id] = s; incoming[s.id] = true;
      if (d.trash[s.id]) delete d.trash[s.id];
    });
    // each student's narrative for the doc, from the window that has its newest copy
    // (an older builder page sends `doc`, one row per student in list order, instead of `rows`)
    if (!p.rows && Array.isArray(p.doc)) {
      p.rows = {};
      (p.order || []).forEach(function (id, i) { if (p.doc[i]) { p.rows[id] = p.doc[i]; p.rows[id].at = -1; } }); // used only for students this save itself brought
    }
    Object.keys(p.rows || {}).forEach(function (id) {
      var r = p.rows[id];
      if (d.students[id] && (incoming[id] || (r.at !== -1 && atOf(id) <= (r.at || 0)))) d.rows[id] = r;
    });

    var order = (p.order || []).filter(function (id) { return d.students[id]; });
    d.order.forEach(function (id) { if (d.students[id] && order.indexOf(id) === -1) order.push(id); });
    Object.keys(d.students).forEach(function (id) { if (order.indexOf(id) === -1) order.push(id); });
    d.order = order;

    var oldS = d.settings || {}, newS = p.settings || {};
    var setS = (newS.at || 0) >= (oldS.at || 0) ? newS : oldS, other = setS === newS ? oldS : newS;
    var goneW = (setS.mineGone || []).map(function (g) { return g.key + '\u0000' + g.t; });
    setS.mine = setS.mine || {};
    Object.keys(other.mine || {}).forEach(function (k) {
      (other.mine[k] || []).forEach(function (w) {
        var have = (setS.mine[k] || []).some(function (x) { return x.t === w.t; });
        if (!have && goneW.indexOf(k + '\u0000' + w.t) === -1) (setS.mine[k] = setS.mine[k] || []).unshift(w);
      });
    });
    d.settings = setS;

    syncDoc_(d);
    writeData_(d, false);
    pulled.forEach(function (id) { if (kept.indexOf(id) === -1 && d.students[id]) kept.push(id); });
    return JSON.stringify({ rev: String(d.rev), kept: kept, trash: trashList_(d) });
  } finally {
    lock.releaseLock();
  }
}

/** Puts a removed student back at the end of the list. */
function restoreRemoved(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var d = readData_(), t = d.trash[id];
    if (t && !d.students[id]) {
      t.student.at = Date.now(); t.student.baseAt = t.student.at;
      d.students[id] = t.student; if (t.row) d.rows[id] = t.row;
      d.order.push(id);
      delete d.trash[id];
      d.rev = (+d.rev || 0) + 1;
      pullDoc_(d);
      syncDoc_(d);
      writeData_(d, false);
    }
  } finally {
    lock.releaseLock();
  }
  return loadState();
}

function writeDoc_(rows) {
  var doc = getDoc_();
  var body = doc.getBody();
  body.clear();
  var tz = Session.getScriptTimeZone();
  var first = body.getParagraphs()[0];
  first.setText('Student Narratives'); // setText returns nothing, so the heading is set on its own line
  first.setHeading(DocumentApp.ParagraphHeading.TITLE);
  var started = rows.filter(function (r) { return r.state ? r.state !== 'blank' : r.words > 0; }).length; // a default closing alone isn't started
  body.appendParagraph(started + ' of ' + rows.length + ' started · updated ' +
      Utilities.formatDate(new Date(), tz, 'MMM d, h:mm a') +
      ' · Edit here or in Narratives → Open Narrative Builder: changes made in either one show up in the other.')
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .editAsText().setItalic(true).setFontSize(9).setForegroundColor('#6b7378');

  var wrote = { text: {}, head: {} };
  rows.forEach(function (r) {
    var head = (r.name || '(no name)') + ' — Grade ' + r.grade;
    var h = body.appendParagraph(head);
    h.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var empty = !r.text || !r.text.trim();
    var text = empty ? '' : norm_(r.text);
    var paras = empty ? ['(not started)'] : text.split(/\n{2,}/);
    paras.forEach(function (ptext, i) {
      if (i) body.appendParagraph('').setHeading(DocumentApp.ParagraphHeading.NORMAL); // a blank line between paragraphs
      ptext.split('\n').forEach(function (line) { // a poem's lines, one to a line
        var t = body.appendParagraph(line).setHeading(DocumentApp.ParagraphHeading.NORMAL).editAsText();
        if (!line) return;
        t.setItalic(false).setFontSize(11).setForegroundColor('#1f2a2e');
        if (empty) t.setItalic(true).setForegroundColor('#9aa0a3');
      });
    });
    if (r.id) { wrote.text[r.id] = text; wrote.head[r.id] = head; }
    var note = r.words + ' words' + (r.words > 200 ? ' — OVER 200 (nothing was cut)' : '');
    var n = body.appendParagraph(note).setHeading(DocumentApp.ParagraphHeading.NORMAL).editAsText();
    n.setItalic(false).setFontSize(8).setForegroundColor(r.words > 200 ? '#b3261e' : '#9aa0a3');
  });
  doc.saveAndClose();
  props_().setProperty('DOC_CHECKED', String(Date.now()));
  return wrote;
}
