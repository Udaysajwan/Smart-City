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

// Initialize Firebase (guarded for pages without Firebase scripts)
let auth = null;
let db = null;
let storage = null;

const INDIA_BOUNDS = {
    southWest: [6.5546, 68.1113],
    northEast: [35.6745, 97.3953]
};

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized');
    } catch (e) {
        console.log('Firebase already initialized');
    }

    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage ? firebase.storage() : null;
}

// Use Firebase emulators locally (opt-in with ?emulator=1 or localStorage useEmulators=true)
const isLocalhost = (typeof window !== 'undefined') &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

let shouldUseEmulators = false;
if (isLocalhost && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const queryFlag = params.get('emulator') === '1';
    const storageFlag = window.localStorage && window.localStorage.getItem('useEmulators') === 'true';
    shouldUseEmulators = queryFlag || storageFlag;
}

if (shouldUseEmulators) {
    if (auth && auth.useEmulator) {
        auth.useEmulator('http://127.0.0.1:9099');
    }
    if (db && db.useEmulator) {
        db.useEmulator('127.0.0.1', 8080);
    }
    if (storage && storage.useEmulator) {
        storage.useEmulator('127.0.0.1', 9199);
    }
}

// Anonymous Sign-in
if (auth) {
    auth.onAuthStateChanged(user => {
        if (!user) {
            auth.signInAnonymously().catch(console.error);
        } else {
            console.log('User signed in:', user.uid);
        }
    });
}

// Mobile nav toggle (shared)
const mobileMenuButton = document.getElementById('mobileMenuButton');
const mobileMenu = document.getElementById('mobileMenu');
if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
        const isHidden = mobileMenu.classList.contains('hidden');
        mobileMenu.classList.toggle('hidden', !isHidden);
        mobileMenuButton.setAttribute('aria-expanded', String(isHidden));
    });
}

// --- Citizen Map (Location Pin) ---
const citizenMapElement = document.getElementById('citizenMap');
if (citizenMapElement && typeof L !== 'undefined') {
    const bounds = L.latLngBounds(INDIA_BOUNDS.southWest, INDIA_BOUNDS.northEast);
    const map = L.map('citizenMap', { zoomControl: true }).setView([20.5937, 78.9629], 5);

    map.setMaxBounds(bounds);
    map.setMinZoom(4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([20.5937, 78.9629], { draggable: true }).addTo(map);

    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const latValue = document.getElementById('latValue');
    const lngValue = document.getElementById('lngValue');

    const updateLocationFields = (latlng) => {
        if (!latlng) return;
        const lat = Number(latlng.lat.toFixed(6));
        const lng = Number(latlng.lng.toFixed(6));
        if (latInput) latInput.value = String(lat);
        if (lngInput) lngInput.value = String(lng);
        if (latValue) latValue.textContent = lat.toFixed(6);
        if (lngValue) lngValue.textContent = lng.toFixed(6);
    };

    updateLocationFields(marker.getLatLng());

    map.on('click', (event) => {
        marker.setLatLng(event.latlng);
        updateLocationFields(event.latlng);
    });

    marker.on('dragend', () => {
        updateLocationFields(marker.getLatLng());
    });

    const useMyLocationButton = document.getElementById('useMyLocation');
    if (useMyLocationButton && navigator.geolocation) {
        useMyLocationButton.addEventListener('click', () => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const latlng = { lat: position.coords.latitude, lng: position.coords.longitude };
                    marker.setLatLng(latlng);
                    map.setView(latlng, 14);
                    updateLocationFields(latlng);
                },
                () => {
                    alert('Unable to access your location. Please pin the map manually.');
                }
            );
        });
    }
}

// --- Citizen Panel Logic ---
const reportForm = document.getElementById('reportForm');
if (reportForm && db) {
    const issueTypeSelect = document.getElementById('issueType');
    const descriptionInput = document.getElementById('description');
    const autoCategoryHint = document.getElementById('autoCategoryHint');
    let userSelectedType = false;

    const inferIssueType = (text) => {
        const input = (text || '').toLowerCase();
        const rules = [
            { type: 'garbage', keywords: ['garbage', 'trash', 'waste', 'dump', 'litter', 'bin', 'overflow'] },
            { type: 'pothole', keywords: ['pothole', 'road', 'hole', 'crack', 'asphalt', 'street damage'] },
            { type: 'traffic', keywords: ['traffic', 'signal', 'jam', 'congestion', 'accident', 'intersection'] },
            { type: 'street_light', keywords: ['street light', 'streetlight', 'lamp', 'light out', 'dark street'] }
        ];

        let bestMatch = null;
        let bestScore = 0;

        rules.forEach(rule => {
            const score = rule.keywords.reduce((count, keyword) => (
                input.includes(keyword) ? count + 1 : count
            ), 0);

            if (score > bestScore) {
                bestScore = score;
                bestMatch = rule.type;
            }
        });

        return bestMatch || 'other';
    };

    if (issueTypeSelect) {
        issueTypeSelect.addEventListener('change', () => {
            userSelectedType = true;
            if (autoCategoryHint) autoCategoryHint.classList.add('hidden');
        });
    }

    if (descriptionInput) {
        descriptionInput.addEventListener('input', () => {
            if (!issueTypeSelect || userSelectedType) return;
            const suggested = inferIssueType(descriptionInput.value);
            issueTypeSelect.value = suggested;
            if (autoCategoryHint) autoCategoryHint.classList.remove('hidden');
        });
    }

    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        const issueType = document.getElementById('issueType').value;
        const description = document.getElementById('description').value;
        const address = document.getElementById('address') ? document.getElementById('address').value.trim() : '';
        const latInput = document.getElementById('lat');
        const lngInput = document.getElementById('lng');
        const lat = latInput ? parseFloat(latInput.value) : null;
        const lng = lngInput ? parseFloat(lngInput.value) : null;
        const imageFile = document.getElementById('image').files[0];

        try {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                alert('Please pin the location on the map before submitting.');
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            let imageUrl = null;

            // 1. Upload Image if exists
            if (imageFile && storage) {
                const storageRef = storage.ref();
                const imageRef = storageRef.child(`reports/${Date.now()}_${imageFile.name}`);
                const snapshot = await imageRef.put(imageFile);
                imageUrl = await snapshot.ref.getDownloadURL();
            } else if (imageFile && !storage) {
                console.warn('Storage not available, skipping image upload.');
            }

            // 2. Save to Firestore
            const userId = auth && auth.currentUser ? auth.currentUser.uid : 'anonymous';
            await db.collection('reports').add({
                type: issueType,
                description: description,
                imageUrl: imageUrl,
                address: address,
                location: { lat, lng },
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId
            });

            alert('Report submitted successfully!');
            reportForm.reset();
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report. Please try again.');
        } finally {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });
}

// --- Admin Dashboard Logic ---
const adminMapElement = document.getElementById('adminMap');
if (adminMapElement && typeof L !== 'undefined' && db) {
    const bounds = L.latLngBounds(INDIA_BOUNDS.southWest, INDIA_BOUNDS.northEast);

    // Initialize Map
    const map = L.map('adminMap').setView([20.5937, 78.9629], 5);
    map.setMaxBounds(bounds);
    map.setMinZoom(4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Fetch Real Reports from Firestore
    const markersLayer = L.layerGroup().addTo(map);

    const statusColors = {
        pending: '#f97316',
        in_progress: '#0ea5e9',
        resolved: '#22c55e'
    };

    db.collection('reports').orderBy('createdAt', 'desc').limit(20).onSnapshot((snapshot) => {
        markersLayer.clearLayers();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.location) {
                const status = data.status || 'pending';
                const color = statusColors[status] || '#64748b';
                L.circleMarker([data.location.lat, data.location.lng], {
                    radius: 8,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.8
                })
                    .addTo(markersLayer)
                    .bindPopup(`<b>${data.type.toUpperCase()}</b><br>${data.description}<br><span>Status: ${status}</span>`);
            }
        });
    });
}

// --- Admin Reports List ---
const reportsList = document.getElementById('reportsList');
if (reportsList && db) {
    const statusOptions = [
        { value: 'pending', label: 'Pending' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'resolved', label: 'Resolved' }
    ];

    const renderReportRow = (doc) => {
        const data = doc.data();
        const wrapper = document.createElement('div');
        wrapper.className = 'py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4';

        const meta = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'font-semibold text-slate-900';
        title.textContent = `${data.type ? data.type.toUpperCase() : 'ISSUE'} • ${data.address || 'Location pinned'}`;

        const desc = document.createElement('div');
        desc.className = 'text-slate-500 text-sm mt-1';
        desc.textContent = data.description || 'No description provided.';

        const time = document.createElement('div');
        time.className = 'text-xs text-slate-400 mt-1';
        if (data.createdAt && data.createdAt.toDate) {
            time.textContent = `Submitted: ${data.createdAt.toDate().toLocaleString()}`;
        } else {
            time.textContent = 'Submitted: just now';
        }

        meta.appendChild(title);
        meta.appendChild(desc);
        meta.appendChild(time);

        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-3';

        const select = document.createElement('select');
        select.className = 'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white';
        statusOptions.forEach(option => {
            const item = document.createElement('option');
            item.value = option.value;
            item.textContent = option.label;
            if (option.value === (data.status || 'pending')) item.selected = true;
            select.appendChild(item);
        });

        const button = document.createElement('button');
        button.className = 'bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition';
        button.textContent = 'Update';

        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = 'Updating...';
            try {
                const newStatus = select.value;
                const updatePayload = {
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                if (newStatus === 'resolved') {
                    updatePayload.resolvedAt = firebase.firestore.FieldValue.serverTimestamp();
                }
                await db.collection('reports').doc(doc.id).update(updatePayload);
            } catch (error) {
                console.error('Failed to update report status', error);
                alert('Unable to update status. Please try again.');
            } finally {
                button.disabled = false;
                button.textContent = 'Update';
            }
        });

        actions.appendChild(select);
        actions.appendChild(button);

        wrapper.appendChild(meta);
        wrapper.appendChild(actions);
        return wrapper;
    };

    db.collection('reports').orderBy('createdAt', 'desc').limit(20).onSnapshot((snapshot) => {
        reportsList.innerHTML = '';
        if (snapshot.empty) {
            reportsList.innerHTML = '<div class=\"py-4 text-slate-500 italic\">No reports yet.</div>';
            return;
        }
        snapshot.forEach(doc => {
            reportsList.appendChild(renderReportRow(doc));
        });
    });
}

// --- Citizen Recent Reports ---
const recentReports = document.getElementById('recentReports');
if (recentReports && auth && db) {
    auth.onAuthStateChanged(user => {
        if (!user) return;
        db.collection('reports')
            .where('userId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .onSnapshot((snapshot) => {
                recentReports.innerHTML = '';
                if (snapshot.empty) {
                    recentReports.innerHTML = '<div class=\"text-slate-500 italic\">No recent reports to display.</div>';
                    return;
                }
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const item = document.createElement('div');
                    item.className = 'p-3 rounded-xl border border-slate-100 bg-white/90';

                    const title = document.createElement('div');
                    title.className = 'font-semibold text-slate-800';
                    title.textContent = data.type ? data.type.toUpperCase() : 'ISSUE';

                    const status = document.createElement('div');
                    status.className = 'text-xs text-slate-500 mt-1';
                    status.textContent = `Status: ${data.status || 'pending'}`;

                    const time = document.createElement('div');
                    time.className = 'text-xs text-slate-400 mt-1';
                    if (data.createdAt && data.createdAt.toDate) {
                        time.textContent = data.createdAt.toDate().toLocaleString();
                    }

                    item.appendChild(title);
                    item.appendChild(status);
                    item.appendChild(time);
                    recentReports.appendChild(item);
                });
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
                borderColor: '#0f766e',
                backgroundColor: 'rgba(15, 118, 110, 0.12)',
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
                backgroundColor: ['#22c55e', '#f59e0b', '#fb7185', '#14b8a6', '#f97316']
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
