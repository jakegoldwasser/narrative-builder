/**
 * Narrative Builder — Google Apps Script (bound to your narratives Google Doc)
 * Setup: in your Google Doc, Extensions → Apps Script. Paste this into Code.gs,
 * add an HTML file named "Index" with the contents of Index.html, save, then reload the doc.
 * A "Narratives" menu appears. Your work is stored with the script and the doc is
 * rewritten (a few seconds after each change) so it always shows every narrative.
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

/** Returns everything saved so far as a JSON string. */
function loadState() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var order = JSON.parse(props.order || '[]');
  var students = [];
  order.forEach(function (id) { if (props['s_' + id]) students.push(JSON.parse(props['s_' + id])); });
  return JSON.stringify({ settings: settingsOf_(props), students: students, rev: props.rev || '0' });
}

/* Settings are kept in two parts, because each stored item holds at most 9 KB: the settings themselves,
   and each question's saved wordings on their own (m_<question>). */
function settingsOf_(props) {
  var s = JSON.parse(props.settings || '{}');
  s.mine = s.mine || {};
  Object.keys(props).forEach(function (k) { if (k.indexOf('m_') === 0) s.mine[k.slice(2)] = JSON.parse(props[k]); });
  return s;
}

/** Changes with every save, so an open builder can tell that another window saved. */
function getRev() {
  return PropertiesService.getScriptProperties().getProperty('rev') || '0';
}

/* Saving never loses work, even with the builder open on two computers:
   - a student is only replaced by a copy edited at the same time or later (each copy carries `at`);
   - a student is only deleted when a window says it was removed, never because a window didn't know about it;
   - settings: the newer copy wins, but no saved wording is lost unless it was removed.
   It answers with the students it kept as they were, so that window can load the newer copies. */
function saveState(json) {
  var p = JSON.parse(json);
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    var sp = PropertiesService.getScriptProperties();
    var props = sp.getProperties();
    var rev = (+props.rev || 0) + 1;
    var removed = p.removed || [];
    var gone = function (id) { return removed.indexOf(id) !== -1; };
    var atOf = function (id) { try { return JSON.parse(props['s_' + id]).at || 0; } catch (e) { return -1; } };
    var batch = { rev: String(rev) }, kept = [], incoming = {};

    (p.students || []).forEach(function (s) {
      if (gone(s.id)) return;
      if (props['s_' + s.id] && atOf(s.id) > (s.at || 0)) { kept.push(s.id); return; }
      batch['s_' + s.id] = JSON.stringify(s); incoming[s.id] = true;
    });
    // each student's narrative for the doc, from the window that has its newest copy
    Object.keys(p.rows || {}).forEach(function (id) {
      var r = p.rows[id];
      if (!gone(id) && (incoming[id] || (props['s_' + id] && atOf(id) <= (r.at || 0)))) batch['d_' + id] = JSON.stringify(r);
    });

    var exists = function (id) { return !gone(id) && (incoming[id] || props['s_' + id]); };
    var order = (p.order || []).filter(exists);
    JSON.parse(props.order || '[]').forEach(function (id) { if (exists(id) && order.indexOf(id) === -1) order.push(id); });
    batch.order = JSON.stringify(order);

    var oldS = settingsOf_(props), newS = p.settings || {};
    var setS = (newS.at || 0) >= (oldS.at || 0) ? newS : oldS, other = setS === newS ? oldS : newS;
    var goneW = (setS.mineGone || []).map(function (g) { return g.key + '\u0000' + g.t; });
    setS.mine = setS.mine || {};
    Object.keys(other.mine || {}).forEach(function (k) {
      (other.mine[k] || []).forEach(function (w) {
        var have = (setS.mine[k] || []).some(function (x) { return x.t === w.t; });
        if (!have && goneW.indexOf(k + '\u0000' + w.t) === -1) (setS.mine[k] = setS.mine[k] || []).unshift(w);
      });
    });
    Object.keys(setS.mine).forEach(function (k) { batch['m_' + k] = JSON.stringify(setS.mine[k]); });
    var plain = {}; Object.keys(setS).forEach(function (k) { if (k !== 'mine') plain[k] = setS[k]; });
    batch.settings = JSON.stringify(plain);

    sp.setProperties(batch, false);
    removed.forEach(function (id) { sp.deleteProperty('s_' + id); sp.deleteProperty('d_' + id); });

    var all = sp.getProperties();
    writeDoc_(order.map(function (id) {
      if (all['d_' + id]) return JSON.parse(all['d_' + id]);
      var st = JSON.parse(all['s_' + id]);
      return { name: st.name, grade: st.grade, text: '', words: 0 };
    }));
    return JSON.stringify({ rev: String(rev), kept: kept });
  } finally {
    lock.releaseLock();
  }
}

function writeDoc_(rows) {
  var doc = getDoc_();
  var body = doc.getBody();
  body.clear();
  var tz = Session.getScriptTimeZone();
  var first = body.getParagraphs()[0];
  first.setText('Student Narratives').setHeading(DocumentApp.ParagraphHeading.TITLE);
  var started = rows.filter(function (r) { return r.words > 0; }).length;
  body.appendParagraph(started + ' of ' + rows.length + ' started · updated ' +
      Utilities.formatDate(new Date(), tz, 'MMM d, h:mm a') +
      ' · Edit in Narratives → Open Narrative Builder (changes made directly here are overwritten).')
    .setHeading(DocumentApp.ParagraphHeading.NORMAL)
    .editAsText().setItalic(true).setFontSize(9).setForegroundColor('#6b7378');

  rows.forEach(function (r) {
    var h = body.appendParagraph((r.name || '(no name)') + ' — Grade ' + r.grade);
    h.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var empty = !r.text || !r.text.trim();
    var paras = empty ? ['(not started)'] : r.text.split(/\n{2,}/);
    paras.forEach(function (ptext) {
      var t = body.appendParagraph(ptext).setHeading(DocumentApp.ParagraphHeading.NORMAL).editAsText();
      t.setItalic(false).setFontSize(11).setForegroundColor('#1f2a2e');
      if (empty) t.setItalic(true).setForegroundColor('#9aa0a3');
    });
    var note = r.words + ' words' + (r.words > 200 ? ' — OVER 200 (nothing was cut)' : '');
    var n = body.appendParagraph(note).setHeading(DocumentApp.ParagraphHeading.NORMAL).editAsText();
    n.setItalic(false).setFontSize(8).setForegroundColor(r.words > 200 ? '#b3261e' : '#9aa0a3');
  });
  doc.saveAndClose();
}
