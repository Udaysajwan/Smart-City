// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAAcJtQ-rr-7FRLOjipC1XNsHgODLCvs00",
    authDomain: "smart-city-ada8d.firebaseapp.com",
    projectId: "smart-city-ada8d",
    storageBucket: "smart-city-ada8d.firebasestorage.app",
    messagingSenderId: "198348279885",
    appId: "1:198348279885:web:cb24e8196a3f7bc05ecc04",
    measurementId: "G-144YHLM2GJ"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized');
    } catch (e) {
        console.log('Firebase already initialized');
    }
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Anonymous Sign-in
auth.onAuthStateChanged(user => {
    if (!user) {
        auth.signInAnonymously().catch(console.error);
    } else {
        console.log('User signed in:', user.uid);
    }
});

// --- Citizen Panel Logic ---
const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = 'Submitting...';
        submitBtn.disabled = true;

        const issueType = document.getElementById('issueType').value;
        const description = document.getElementById('description').value;
        const imageFile = document.getElementById('image').files[0];

        try {
            let imageUrl = null;

            // 1. Upload Image if exists
            if (imageFile) {
                const storageRef = storage.ref();
                const imageRef = storageRef.child(`reports/${Date.now()}_${imageFile.name}`);
                const snapshot = await imageRef.put(imageFile);
                imageUrl = await snapshot.ref.getDownloadURL();
            }

            // 2. Get Location (Mock for now, can add navigator.geolocation)
            const location = { 
                lat: 12.9716 + (Math.random() - 0.5) * 0.01, 
                lng: 77.5946 + (Math.random() - 0.5) * 0.01 
            };

            // 3. Save to Firestore
            await db.collection('reports').add({
                type: issueType,
                description: description,
                imageUrl: imageUrl,
                location: location,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: auth.currentUser ? auth.currentUser.uid : 'anonymous'
            });

            alert('Report submitted successfully!');
            reportForm.reset();
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report. Please try again.');
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

// --- Admin Dashboard Logic ---
const adminMapElement = document.getElementById('adminMap');
if (adminMapElement && typeof L !== 'undefined') {
    // Initialize Map
    const map = L.map('adminMap').setView([12.9716, 77.5946], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Fetch Real Reports from Firestore
    db.collection('reports').orderBy('createdAt', 'desc').limit(20).onSnapshot((snapshot) => {
        // Clear existing markers (in a real app, you'd manage layers)
        // For simplicity, we just add new ones
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.location) {
                const markerColor = data.type === 'garbage' ? 'red' : 'blue';
                L.marker([data.location.lat, data.location.lng])
                 .addTo(map)
                 .bindPopup(`<b>${data.type.toUpperCase()}</b><br>${data.description}`);
            }
        });
    });
}

// --- Insights Logic ---
const insightsElement = document.getElementById('insights');
if (insightsElement) {
    // 1. Initialize Charts
    const ctxTraffic = document.getElementById('trafficChart').getContext('2d');
    new Chart(ctxTraffic, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Vehicle Density (Vehicles/hr)',
                data: [120, 80, 450, 600, 550, 300],
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const ctxAqi = document.getElementById('aqiChart').getContext('2d');
    new Chart(ctxAqi, {
        type: 'bar',
        data: {
            labels: ['North', 'South', 'East', 'West', 'Central'],
            datasets: [{
                label: 'AQI Level',
                data: [45, 80, 120, 60, 150],
                backgroundColor: ['#22c55e', '#eab308', '#f97316', '#22c55e', '#ef4444']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 2. Fetch ML Predictions
    window.fetchInsights = async function() {
        const terminal = document.getElementById('insights');
        terminal.innerHTML += '\n> Connecting to ML Model...';
        
        try {
            // Simulate delay
            await new Promise(r => setTimeout(r, 1000));
            
            // Try fetching from backend, fallback to mock
            // const res = await fetch('/api/predict', ...);
            
            // Mock Response for Demo
            const mockPrediction = {
                traffic_congestion_probability: 0.85,
                suggested_action: "Reroute heavy vehicles from Zone 4",
                air_quality_forecast: "Declining in next 2 hours"
            };

            terminal.innerHTML += `\n> Data Received: [Packet 24KB]`;
            terminal.innerHTML += `\n> Analysis Complete.`;
            terminal.innerHTML += `\n\n<span class="text-green-400">${JSON.stringify(mockPrediction, null, 2)}</span>`;
            terminal.scrollTop = terminal.scrollHeight;

        } catch (error) {
            terminal.innerHTML += `\n> Error: Connection timed out.`;
        }
    };
}
