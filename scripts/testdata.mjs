// Ververst de gegevens van de testversie: kopieert teams, avonden en instellingen
// van de echte app naar test_teams, test_matches en test_settings.
// Leest de echte gegevens alleen; schrijft uitsluitend in de test_-collecties.
import {initializeApp, cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.client_email) { console.error('Geen service-account gevonden.'); process.exit(1); }
initializeApp({credential: cert(sa)});
const db = getFirestore();

try {
  const summary = {};
  for (const name of ['teams', 'matches', 'settings']) {
    const target = 'test_' + name;
    const w = db.bulkWriter();
    const old = await db.collection(target).listDocuments();
    old.forEach(ref => w.delete(ref));
    const snap = await db.collection(name).get();
    snap.docs.forEach(d => w.set(db.collection(target).doc(d.id), d.data()));
    await w.close();
    summary[target] = snap.size;
  }
  console.log('::notice title=Testgegevens ververst::' + JSON.stringify(summary));
} catch (e) {
  console.log('::error title=Testgegevens verversen mislukt::' + String(e && (e.code + ' ' + e.message)).replace(/\n/g, ' '));
  process.exit(1);
}
