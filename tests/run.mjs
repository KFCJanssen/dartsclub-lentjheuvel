// Automatische controles voor de scorebord-app.
// Draait in GitHub Actions vóór elke deploy; faalt een controle, dan gaat er niets online.
// Lokaal draaien: node tests/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

// ---------- de app-code laden zonder browser en zonder Firebase ----------
const m = html.match(/<script type="module">([\s\S]*)<\/script>/);
assert.ok(m, 'module-script niet gevonden in index.html');
let code = m[1];
const imported = [];
code = code.replace(/^import\s*\{([^}]*)\}\s*from\s*"[^"]+";\s*$/gm, (_, names) => {
  names.split(',').map(x => x.trim()).filter(Boolean).forEach(n => imported.push(n));
  return '';
});
const stubs = imported.map(n => `const ${n}=()=>({});`).join('\n');

let app = null;
const noop = () => {};
const el = () => ({innerHTML: '', hidden: true, textContent: '', style: {}, addEventListener: noop});
globalThis.window = {__DC_TEST__: api => { app = api; }, addEventListener: noop, scrollTo: noop};
globalThis.document = {getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, documentElement: {}, visibilityState: 'visible'};
globalThis.location = {hash: '', reload: noop};
globalThis.localStorage = {getItem: () => null, setItem: noop};
Object.defineProperty(globalThis, 'navigator', {value: {onLine: true}, configurable: true});
globalThis.getComputedStyle = () => ({fontSize: '16px'});
globalThis.fetch = async () => ({ok: false});

try {
  new Function(stubs + '\n' + code)();
} catch (e) {
  console.error('De app-code kon niet geladen worden:', e);
  process.exit(1);
}
assert.ok(app, 'testhaakje (__DC_TEST__) werd niet aangeroepen');

// ---------- mini-testrunner ----------
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.message || e)); }
}
const leg = (starter, turns) => ({starter, turns});
const x01 = (kind, legs, extra = {}) => ({n: 1, kind, size: 1, bestOf: 3, home: [], away: [], legs, winner: null, ...extra});

console.log('501 / 701');
test('score gaat van de rest af', () => {
  const st = app.x01State(x01('501', []), leg(0, [60, 45]));
  assert.deepEqual(st.rem, [441, 456]);
});
test('701 begint op 701', () => {
  assert.deepEqual(app.x01State(x01('701', []), leg(0, [])).rem, [701, 701]);
});
test('te veel gegooid = dood, rest blijft gelijk', () => {
  const g = x01('501', []);
  const st = app.x01State(g, leg(0, [180, 0, 180, 0, 100, 0, 60]));
  // thuis: 501-180-180-100 = 41, dan 60 → dood
  assert.equal(st.rem[0], 41);
  assert.equal(st.entries[6].bust, true);
});
test('rest 1 = dood', () => {
  const st = app.x01State(x01('501', []), leg(0, [180, 0, 180, 0, 140]));
  // 501-180-180 = 141, dan 140 → zou 1 overlaten → dood, rest blijft 141
  assert.equal(st.rem[0], 141);
  assert.equal(st.entries[4].bust, true);
});
test('Dood-knop telt als 0 en als dood', () => {
  const st = app.x01State(x01('501', []), leg(0, [app.DOOD]));
  assert.equal(st.rem[0], 501);
  assert.equal(st.entries[0].bust, true);
});
test('uitgooien wint de leg', () => {
  const st = app.x01State(x01('501', []), leg(0, [180, 0, 180, 0, 141]));
  assert.equal(st.winner, 0);
});
test('beurt wisselt tussen de kanten', () => {
  const st = app.x01State(x01('501', []), leg(1, [20, 30, 40]));
  assert.deepEqual(st.entries.map(e => e.side), [1, 0, 1]);
});
test('koppels: spelers wisselen binnen een kant', () => {
  const g = x01('701', [], {size: 2});
  const st = app.x01State(g, leg(0, [1, 1, 1, 1]));
  assert.deepEqual(st.entries.map(e => [e.side, e.pi]), [[0, 0], [1, 0], [0, 1], [1, 1]]);
});
test('onmogelijke scores worden geweigerd', () => {
  for (const s of [181, 179, 163, -5]) assert.ok(app.validX01(s, 501), 'score ' + s + ' zou geweigerd moeten worden');
  for (const s of [180, 0, 60, 140, 26]) assert.equal(app.validX01(s, 501), null, 'score ' + s + ' zou geldig moeten zijn');
});
test('onmogelijke finishes worden geweigerd', () => {
  for (const r of [169, 168, 166, 165, 163, 162, 159]) assert.ok(app.validX01(r, r), r + ' kan niet uitgegooid worden');
  for (const r of [170, 167, 164, 161, 160, 40, 2]) assert.equal(app.validX01(r, r), null, r + ' kan wel uitgegooid worden');
});
test('best of 3: twee legs winnen = partij gewonnen', () => {
  const g = x01('501', [leg(0, [180, 0, 180, 0, 141])]);
  let r = app.normalizeX01(g);
  assert.deepEqual(r, {leg: 0});
  assert.equal(g.legs.length, 2);
  assert.equal(g.legs[1].starter, 1, 'andere kant begint de volgende leg');
  g.legs[1].turns = [0, 180, 0, 180, 0, 141];
  r = app.normalizeX01(g);
  assert.deepEqual(r, {game: 0});
  assert.equal(g.winner, 0);
});
test('aantal te winnen legs per best-of', () => {
  assert.equal(app.need({bestOf: 3}), 2);
  assert.equal(app.need({bestOf: 5}), 3);
  assert.equal(app.need({bestOf: 7}), 4);
  assert.equal(app.need({bestOf: 3, solo: true}), 3, 'alleen oefenen: aantal legs');
});

console.log('Tac-tic');
const allClosed = () => { const l = app.newTacLeg(); app.TARGETS.forEach(t => { l.marks[0][t] = 3; l.marks[1][t] = 3; }); return l; };
test('alles dicht en meer punten wint', () => {
  const l = app.newTacLeg(); app.TARGETS.forEach(t => l.marks[0][t] = 3); l.pts = [20, 10];
  assert.deepEqual(app.tacVerdict(l), {win: 0});
});
test('alles dicht maar minder punten wint niet', () => {
  const l = app.newTacLeg(); app.TARGETS.forEach(t => l.marks[0][t] = 3); l.pts = [5, 10];
  assert.equal(app.tacVerdict(l), null);
});
test('beide alles dicht en gelijk = overgooien', () => {
  const l = allClosed(); l.pts = [30, 30];
  assert.deepEqual(app.tacVerdict(l), {replay: true});
});
test('leg toekennen wisselt de beginner en telt legs', () => {
  const g = {kind: 'tactic', size: 2, bestOf: 3, legs: [app.newTacLeg(0)], winner: null};
  app.tacAward(g, g.legs[0], 1);
  assert.equal(g.legs.length, 2);
  assert.equal(g.legs[1].starter, 1);
  app.tacAward(g, g.legs[1], 1);
  assert.equal(g.winner, 1);
});

console.log('Speelavonden');
test('competitie = 10 partijen, beker = 9', () => {
  const t = {id: 't', name: 'Test', division: '3e divisie'};
  assert.equal(app.newNight(t, {type: 'Divisie'}).games.length, 10);
  assert.equal(app.newNight(t, {type: 'Beker'}).games.length, 9);
});
test('volgorde van de avond', () => {
  const g = app.newNight({id: 't', name: 'T', division: '4e divisie'}, {type: 'Divisie'}).games;
  assert.deepEqual(g.map(x => x.kind + '/' + x.size), ['501/1', '501/1', '501/1', '501/1', '701/2', '701/2', 'tactic/2', 'tactic/2', '501/1', '501/1']);
});
test('best of per divisie (standaard)', () => {
  app.S.settings = null;
  assert.equal(app.boFor('Hoofdklasse', '501'), 7);
  assert.equal(app.boFor('1e divisie', '701'), 7);
  assert.equal(app.boFor('2e divisie', '501'), 5);
  assert.equal(app.boFor('3e divisie', '501'), 3);
  assert.equal(app.boFor('Hoofdklasse', 'tactic'), 3);
});
test('ingevoerde uitslag telt mee in stand en legs', () => {
  const mm = {manual: true, result: {games: [4, 6], legs: [11, 15]}, games: []};
  assert.deepEqual(app.matchScore(mm), [4, 6]);
  assert.deepEqual(app.legTotal(mm), [11, 15]);
});

console.log('Speelschema\'s');
test('schedules.json is geldig', () => {
  const list = JSON.parse(fs.readFileSync(path.join(root, 'public/schedules.json'), 'utf8'));
  assert.ok(Array.isArray(list) && list.length);
  for (const e of list) {
    assert.ok(e.teamId && e.team && e.version, 'teamId/team/version ontbreekt');
    const ids = new Set(), rounds = [];
    let prev = '';
    for (const s of e.schedule) {
      assert.match(s.date, /^\d{4}-\d{2}-\d{2}$/, e.team + ': datum ' + s.date);
      assert.ok(s.date >= prev, e.team + ': data niet op volgorde bij ' + s.date);
      prev = s.date;
      assert.ok(!ids.has(s.id), e.team + ': dubbel id ' + s.id); ids.add(s.id);
      assert.ok(['Divisie', 'Beker', 'Info'].includes(s.type), e.team + ': onbekend type ' + s.type);
      if (s.type === 'Divisie') { rounds.push(+s.round); assert.ok(['Thuis', 'Uit'].includes(s.venue)); }
    }
    assert.deepEqual(rounds, rounds.slice().sort((a, b) => a - b), e.team + ': rondes niet op volgorde');
  }
});

console.log('Schermen');
test('alle schermen zijn op te bouwen zonder fouten', () => {
  const S = app.S;
  S.ui = {}; S.gate = 'ok';
  const t = {id: 't1', name: 'Lentjheuvel 5', division: '3e divisie', trackAway: true, players: [{id: 'p', name: 'Kai', role: 'C', nr: '1234'}],
    schedule: [{id: 's1', date: '2026-09-18', type: 'Divisie', round: '1', venue: 'Uit', opponent: 'Heksenberg 3', address: 'X'}, {id: 's2', date: '2026-10-09', type: 'Beker', opponent: 'Bekerronde'}, {id: 's3', date: '2030-01-01', type: 'Info', opponent: 'Vrije week'}]};
  S.teams = {t1: t};
  const night = app.newNight(t, {type: 'Divisie', opponent: 'Bullys 2', date: '2026-10-30'});
  night.games[0].legs = [leg(0, [100, 60, 180])];
  night.games[6].legs = [app.newTacLeg(0)];
  const manual = {id: 'mm', kind: 'avond', manual: true, teamId: 't1', teamName: 'Lentjheuvel 5', opponent: 'Flying Darts 5', date: '2026-09-25', status: 'klaar', games: [], result: {games: [4, 6], legs: [11, 15]}};
  const los = {id: 'lo', kind: 'los', games: [{n: 1, kind: '501', size: 1, solo: true, bestOf: 3, home: ['Kai'], away: [], legs: [], winner: null}]};
  S.matches = {[night.id]: night, mm: manual, lo: los};
  const out = [
    app.vHome(), app.vTeamInfo('t1'), app.vAvond(night.id), app.vAvond('mm'),
    app.vX01(night, night.games[0]), app.vTac(night, night.games[6]),
    app.vX01(los, los.games[0]), app.vOefenen(), app.vUitleg(), app.vBeheer()
  ];
  S.route = {name: 'los'}; out.push(app.vLos());
  S.route = {name: 'teaminfo', id: 't1'}; app.openResult(t, t.schedule[0], null); out.push(app.resultDialog());
  for (const h of out) { assert.equal(typeof h, 'string'); assert.ok(h.length > 50); assert.ok(!/undefined|NaN/.test(h.replace(/data-[a-z]+="[^"]*"/g, '')), 'tekst "undefined" of "NaN" op het scherm'); }
});

console.log(`\n${passed} geslaagd, ${failed} mislukt`);
process.exit(failed ? 1 : 0);
