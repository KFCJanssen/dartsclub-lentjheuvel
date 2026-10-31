// Maakt een kopie van alle clubgegevens uit Firestore.
// Draait in GitHub Actions (zie .github/workflows/backup.yml) en schrijft naar de map ./backup-out.
// De club- en beheercode (collectie "config") worden bewust NIET gekopieerd.
import fs from 'node:fs';
import {initializeApp, cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.client_email) { console.error('Geen service-account gevonden.'); process.exit(1); }
initializeApp({credential: cert(sa)});
const db = getFirestore();

const day = new Date().toISOString().slice(0, 10);
const out = `backup-out/${day}`;
fs.mkdirSync(out, {recursive: true});

const plain = v => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x.toDate === 'function') ? x.toDate().toISOString() : x));
const summary = {};
try {
for (const name of ['teams', 'matches', 'settings', 'devices', 'admins']) {
  const snap = await db.collection(name).get();
  const docs = snap.docs.map(d => {
    const data = plain(d.data());
    if (name === 'devices' || name === 'admins') delete data.code; // codes nooit in de backup
    return {id: d.id, ...data};
  });
  fs.writeFileSync(`${out}/${name}.json`, JSON.stringify(docs, null, 1));
  summary[name] = docs.length;
}
} catch (e) {
  console.log('::error title=Backup mislukt::' + (e && (e.code + ' ' + e.message)).replace(/\n/g, ' '));
  process.exit(1);
}
fs.writeFileSync(`${out}/samenvatting.json`, JSON.stringify({datum: day, aantallen: summary}, null, 1));
console.log('Backup', day, summary);
