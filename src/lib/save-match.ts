import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { SavedMatch } from './match-types';

export async function saveMatchToFirestore(match: SavedMatch): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const docRef = await addDoc(collection(db, 'matches'), {
    ...match,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
