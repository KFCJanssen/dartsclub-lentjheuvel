// Controleert de database-regels (firestore.rules) in de Firestore-emulator.
// Draait in GitHub Actions: firebase emulators:exec --only firestore "node tests/rules.test.mjs"
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {initializeTestEnvironment, assertSucceeds, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-dartsclub',
  firestore: {rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080},
});

// startsituatie (zonder regels)
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'config/access'), {code: 'CLUB123abc456'});
  await setDoc(doc(db, 'config/admin'), {code: 'ADMIN987xyz'});
  await setDoc(doc(db, 'devices/tablet'), {code: 'CLUB123abc456', name: 'Tablet bar'});
  await setDoc(doc(db, 'devices/beheer'), {code: 'CLUB123abc456', name: 'Telefoon'});
  await setDoc(doc(db, 'admins/beheer'), {code: 'ADMIN987xyz'});
  await setDoc(doc(db, 'teams/t1'), {id: 't1', name: 'Lentjheuvel 5', players: [], schedule: [{id: 's1'}], scheduleNote: 'x', scheduleVersion: 'v1', rev: 1});
  await setDoc(doc(db, 'matches/m1'), {id: 'm1', kind: 'avond', teamId: 't1', games: [], rev: 1});
  await setDoc(doc(db, 'matches/m2'), {id: 'm2', kind: 'avond', teamId: 't1', games: [], rev: 1, deleted: {at: 1}});
});

const tablet = env.authenticatedContext('tablet').firestore();
const beheer = env.authenticatedContext('beheer').firestore();
const vreemd = env.authenticatedContext('vreemd').firestore();
const nieuw = env.authenticatedContext('nieuw').firestore();

let ok = 0, bad = 0;
async function t(name, fn) {
  try { await fn(); ok++; console.log('  ✓ ' + name); }
  catch (e) { bad++; console.log('  ✗ ' + name + '\n      ' + (e && e.message || e)); }
}

console.log('Koppelen');
await t('nieuw apparaat met juiste clubcode mag koppelen', () => assertSucceeds(setDoc(doc(nieuw, 'devices/nieuw'), {code: 'CLUB123abc456', name: 'X'})));
await t('verkeerde clubcode wordt geweigerd', () => assertFails(setDoc(doc(vreemd, 'devices/vreemd'), {code: 'fout'})));
await t('niet-gekoppeld apparaat ziet geen teams', () => assertFails(getDoc(doc(vreemd, 'teams/t1'))));
await t('clubcode is nooit leesbaar, ook niet voor beheer', () => assertFails(getDoc(doc(beheer, 'config/access'))));

console.log('Gewone tablet');
await t('mag teams en avonden lezen', () => assertSucceeds(getDoc(doc(tablet, 'teams/t1'))));
await t('mag spelers aanpassen', () => assertSucceeds(setDoc(doc(tablet, 'teams/t1'), {id: 't1', name: 'Lentjheuvel 5', players: [{name: 'Kai'}], schedule: [{id: 's1'}], scheduleNote: 'x', scheduleVersion: 'v1', rev: 2})));
await t('mag het speelschema niet aanpassen', () => assertFails(setDoc(doc(tablet, 'teams/t1'), {id: 't1', name: 'Lentjheuvel 5', players: [], schedule: [], scheduleNote: 'x', scheduleVersion: 'v1', rev: 3})));
await t('mag wel een nieuw meegeleverd speelschema zetten', () => assertSucceeds(setDoc(doc(tablet, 'teams/t1'), {schedule: [{id: 's2'}], scheduleVersion: 'v2'}, {merge: true})));
await t('mag geen team verwijderen', () => assertFails(deleteDoc(doc(tablet, 'teams/t1'))));
await t('mag geen team naar de prullenbak verplaatsen', () => assertFails(setDoc(doc(tablet, 'teams/t1'), {deleted: {at: 1}}, {merge: true})));
await t('mag scores opslaan', () => assertSucceeds(setDoc(doc(tablet, 'matches/m1'), {id: 'm1', kind: 'avond', teamId: 't1', games: [1], rev: 2})));
await t('mag één partij apart opslaan', () => assertSucceeds(updateDoc(doc(tablet, 'matches/m1'), {'gm.3': {n: 3, legs: []}, rev: 3})));
await t('mag een avond naar de prullenbak verplaatsen', () => assertSucceeds(setDoc(doc(tablet, 'matches/m1'), {id: 'm1', kind: 'avond', teamId: 't1', games: [1], rev: 3, deleted: {at: 2}})));
await t('mag niet terugzetten uit de prullenbak', () => assertFails(setDoc(doc(tablet, 'matches/m2'), {id: 'm2', kind: 'avond', teamId: 't1', games: [], rev: 2})));
await t('mag niet definitief verwijderen', () => assertFails(deleteDoc(doc(tablet, 'matches/m2'))));
await t('mag niet archiveren', () => assertFails(setDoc(doc(tablet, 'matches/m1'), {archived: '2026-2027'}, {merge: true})));
await t('mag de tabletlijst niet zien', () => assertFails(getDocs(collection(tablet, 'devices'))));
await t('mag eigen "laatst actief" bijwerken', () => assertSucceeds(setDoc(doc(tablet, 'devices/tablet'), {lastSeen: 123}, {merge: true})));
await t('mag eigen koppeling niet anders aanpassen', () => assertFails(setDoc(doc(tablet, 'devices/tablet'), {code: 'iets'}, {merge: true})));
await t('mag geen andere tablet ontkoppelen', () => assertFails(deleteDoc(doc(tablet, 'devices/beheer'))));
await t('mag de clubcode niet wijzigen', () => assertFails(setDoc(doc(tablet, 'config/access'), {code: 'nieuw'})));
await t('mag de instellingen niet wijzigen', () => assertFails(setDoc(doc(tablet, 'settings/format'), {bo: {}})));

console.log('Beheer-tablet');
await t('ziet de tabletlijst', () => assertSucceeds(getDocs(collection(beheer, 'devices'))));
await t('mag terugzetten uit de prullenbak', () => assertSucceeds(setDoc(doc(beheer, 'matches/m2'), {id: 'm2', kind: 'avond', teamId: 't1', games: [], rev: 2})));
await t('mag het speelschema aanpassen', () => assertSucceeds(setDoc(doc(beheer, 'teams/t1'), {schedule: []}, {merge: true})));
await t('mag archiveren', () => assertSucceeds(setDoc(doc(beheer, 'matches/m1'), {archived: '2026-2027'}, {merge: true})));
await t('mag de clubcode wijzigen', () => assertSucceeds(setDoc(doc(beheer, 'config/access'), {code: 'NIEUW123abc456'})));
await t('mag de beheercode niet via de app wijzigen', () => assertFails(setDoc(doc(beheer, 'config/admin'), {code: 'x'})));
await t('mag een tablet ontkoppelen', () => assertSucceeds(deleteDoc(doc(beheer, 'devices/nieuw'))));
await t('mag definitief verwijderen', () => assertSucceeds(deleteDoc(doc(beheer, 'matches/m2'))));
await t('testversie: tablet mag in de testkopie spelen', () => assertSucceeds(setDoc(doc(tablet, 'test_matches/x'), {id: 'x', kind: 'avond', games: []})));
await t('testversie: zelfde beperkingen (schema alleen beheer)', () => assertFails(setDoc(doc(tablet, 'test_teams/t9'), {schedule: [1]}, {merge: true}).then(() => setDoc(doc(tablet, 'test_teams/t9'), {schedule: [2]}, {merge: true}))));
await t('na ontkoppelen geen toegang meer', () => assertFails(getDoc(doc(nieuw, 'teams/t1'))));
await t('gekoppelde tablet blijft werken na nieuwe clubcode', () => assertSucceeds(getDoc(doc(tablet, 'teams/t1'))));

await env.cleanup();
console.log(`\n${ok} geslaagd, ${bad} mislukt`);
process.exit(bad ? 1 : 0);
