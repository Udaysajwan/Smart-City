// Firebase wiring: replace firebaseConfig with your web app values from Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyAAcJtQ-rr-7FRLOjipC1XNsHgODLCvs00",
  authDomain: "smart-city-ada8d.firebaseapp.com",
  projectId: "smart-city-ada8d",
  storageBucket: "smart-city-ada8d.firebasestorage.app",
  messagingSenderId: "198348279885",
  appId: "1:198348279885:web:cb24e8196a3f7bc05ecc04",
  measurementId: "G-144YHLM2GJ"
};

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  try { firebase.initializeApp(firebaseConfig); } catch (e) { /* already initialized */ }
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Sign in anonymously for demos (replace with proper auth flows as needed)
auth.onAuthStateChanged(user => {
  if (!user) {
    auth.signInAnonymously().catch(console.error);
  }
});

// Simple report flow: prompts for type and creates a Firestore document
document.getElementById('reportBtn').addEventListener('click', async () => {
  const type = prompt('Issue type (e.g., garbage, pothole, traffic):', 'garbage');
  if (!type) return;

  // Example: you should replace with real geolocation and image upload UI
  const location = { lat: 12.9716, lng: 77.5946 };

  try {
    const docRef = await db.collection('reports').add({
      type,
      location,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      userId: auth.currentUser ? auth.currentUser.uid : null
    });
    alert('Report submitted: ' + docRef.id);
  } catch (err) {
    console.error(err);
    alert('Failed to submit report');
  }
});

// Call ML API via Firebase Functions proxy at /api/predict
async function fetchInsights() {
  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensor_values: [12.3, 4.5, 6.7] })
    });
    if (!res.ok) throw new Error('Bad response');
    const data = await res.json();
    document.getElementById('insights').textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    document.getElementById('insights').textContent = 'ML service unavailable';
  }
}

fetchInsights();
