// calendar/apple.js — reads the real macOS Calendar via JXA (osascript).
// Accessing Calendar triggers the system Calendar permission prompt the first
// time; the user must Allow it (or enable it in System Settings → Privacy &
// Security → Calendars). No extra dependencies or compilation required.
const { execFile } = require('child_process');

function runJXA(script) {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-l', 'JavaScript', '-e', script], { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const msg = (stderr || (err && err.message) || '').toString();
      if (err) {
        if (/not authorized|not allowed|-1743|privacy/i.test(msg)) {
          return reject(new Error('Calendar access was denied. Enable it in System Settings → Privacy & Security → Calendars, then try again.'));
        }
        return reject(new Error(msg.trim() || 'Could not read macOS Calendar.'));
      }
      resolve((stdout || '').trim());
    });
  });
}

const CONNECT = [
  'function run() {',
  "  var Cal = Application('Calendar');",
  '  var names = Cal.calendars.name();',  // touching this triggers the TCC prompt
  "  return JSON.stringify({ account: 'macOS Calendar', calendars: names });",
  '}',
].join('\n');

const LIST = [
  'function run() {',
  "  var Cal = Application('Calendar');",
  '  var start = new Date(); start.setHours(0,0,0,0);',
  '  var end = new Date(start.getTime()); end.setDate(end.getDate() + 60);',
  '  var out = [];',
  '  var cals = Cal.calendars();',
  '  for (var i = 0; i < cals.length; i++) {',
  '    var evs;',
  '    try { evs = cals[i].events.whose({ _and: [ { startDate: { _greaterThan: start } }, { startDate: { _lessThan: end } } ] })(); }',
  '    catch (e) { evs = []; }',
  '    for (var j = 0; j < evs.length; j++) {',
  '      try {',
  '        var ev = evs[j];',
  '        var sd = ev.startDate();',
  '        var allDay = false; try { allDay = ev.alldayEvent(); } catch (e) {}',
  "        var y = sd.getFullYear(), m = ('0'+(sd.getMonth()+1)).slice(-2), d = ('0'+sd.getDate()).slice(-2);",
  '        var hh = sd.getHours(), mm = sd.getMinutes();',
  "        var ap = hh >= 12 ? 'PM' : 'AM'; var h12 = hh % 12; if (h12 === 0) h12 = 12;",
  "        var time = allDay ? 'All day' : (h12 + ':' + ('0'+mm).slice(-2) + ' ' + ap);",
  "        out.push({ id: ev.uid(), title: ev.summary(), date: y+'-'+m+'-'+d, time: time });",
  '      } catch (e) {}',
  '    }',
  '  }',
  "  out.sort(function(a,b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });",
  '  return JSON.stringify(out);',
  '}',
].join('\n');

async function connect() {
  const out = await runJXA(CONNECT);
  try { return JSON.parse(out); } catch (e) { return { account: 'macOS Calendar' }; }
}
async function listEvents() {
  const out = await runJXA(LIST);
  try { return JSON.parse(out) || []; } catch (e) { return []; }
}

module.exports = { connect, listEvents };
