// Constants
const CONFIG = {
    ORS_API_KEY: '5b3ce3597851110001cf62486bcb783b711d46cbaaa5196c2c053ee6',
    ORS_API_URL: 'https://api.openrouteservice.org/v2/directions/driving-car',
    MIN_RATE: 2.5,
    MAX_RATE: 7,
    CACHE_VERSION: 2,
    OFFLINE_CACHE_NAME: 'distance-calc-offline-v2'
};

// API Usage Management
const apiUsage = {
    _storageKey: 'ors_api_usage',
    requestLimit: 20,
    timeWindowMinutes: 10,
    
    init() {
        this._cleanupOldRequests();
    },
    
    _getRequests() {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey) || '[]');
        } catch (e) {
            console.error('Error reading API usage:', e);
            return [];
        }
    },
    
    _cleanupOldRequests() {
        const now = Date.now();
        const windowMs = this.timeWindowMinutes * 60 * 1000;
        const requests = this._getRequests();
        
        const validRequests = requests.filter(timestamp => 
            now - timestamp < windowMs
        );
        
        localStorage.setItem(this._storageKey, JSON.stringify(validRequests));
    },
    
    increment() {
        const requests = this._getRequests();
        requests.push(Date.now());
        localStorage.setItem(this._storageKey, JSON.stringify(requests));
    },
    
    getRemaining() {
        this._cleanupOldRequests();
        const requests = this._getRequests();
        return Math.max(0, this.requestLimit - requests.length);
    },
    
    canMakeRequest() {
        return this.getRemaining() > 0;
    },

    getTimeUntilReset() {
        const requests = this._getRequests();
        if (requests.length === 0) return 0;
        
        const now = Date.now();
        const windowMs = this.timeWindowMinutes * 60 * 1000;
        const oldestRequest = Math.min(...requests);
        const resetTime = oldestRequest + windowMs - now;
        
        return Math.max(0, Math.ceil(resetTime / 1000));
    }
};

// Cache Management
const distanceCache = {
    _cache: new Map(),
    _storageKey: 'distanceCache',

    init() {
        const stored = localStorage.getItem(this._storageKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                this._cache = new Map(Object.entries(parsed));
            } catch (e) {
                console.error('Cache initialization error:', e);
            }
        }
    },

    _generateKey(wilaya1, wilaya2) {
        return [wilaya1, wilaya2].sort().join('-');
    },

    get(wilaya1, wilaya2) {
        return this._cache.get(this._generateKey(wilaya1, wilaya2));
    },

    set(wilaya1, wilaya2, data) {
        const key = this._generateKey(wilaya1, wilaya2);
        this._cache.set(key, data);
        this._saveToStorage();
    },

    has(wilaya1, wilaya2) {
        return this._cache.has(this._generateKey(wilaya1, wilaya2));
    },

    _saveToStorage() {
        try {
            const cacheObject = Object.fromEntries(this._cache);
            localStorage.setItem(this._storageKey, JSON.stringify(cacheObject));
        } catch (e) {
            console.error('Cache save error:', e);
        }
    }
};

// Recent Searches Management
const recentSearches = {
    _storageKey: 'recentSearches',
    maxItems: 5,

    get() {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey) || '[]');
        } catch (e) {
            console.error('Recent searches retrieval error:', e);
            return [];
        }
    },

    add(wilaya1, wilaya2, distance) {
        const searches = this.get();
        const newSearch = {
            from: wilaya1,
            to: wilaya2,
            distance,
            timestamp: Date.now()
        };

        const filteredSearches = searches.filter(search => 
            !(search.from === wilaya1 && search.to === wilaya2) &&
            !(search.from === wilaya2 && search.to === wilaya1)
        );

        filteredSearches.unshift(newSearch);
        const updatedSearches = filteredSearches.slice(0, this.maxItems);

        try {
            localStorage.setItem(this._storageKey, JSON.stringify(updatedSearches));
            this.updateUI();
        } catch (e) {
            console.error('Recent searches save error:', e);
        }
    },

    updateUI() {
        const recentDiv = document.getElementById('recent-searches');
        const searches = this.get();

        if (searches.length === 0) {
            recentDiv.style.display = 'none';
            return;
        }

        const searchesHTML = searches.map(search => `
            <div class="recent-item" data-from="${search.from}" data-to="${search.to}">
                <div class="route-info">
                    <span class="route-cities">${search.from} ↔ ${search.to}</span>
                    <span class="route-distance">${search.distance} كم</span>
                </div>
                <div class="route-time">${formatTimestamp(search.timestamp)}</div>
            </div>
        `).join('');

        recentDiv.innerHTML = `
            <h3>عمليات البحث الأخيرة</h3>
            ${searchesHTML}
        `;
        recentDiv.style.display = 'block';
    }
};

// Saved Routes Management
const savedRoutes = {
    _storageKey: 'savedRoutes',

    get() {
        try {
            return JSON.parse(localStorage.getItem(this._storageKey) || '[]');
        } catch (e) {
            console.error('Saved routes retrieval error:', e);
            return [];
        }
    },

    toggle(wilaya1, wilaya2, distance = null) {
        const routes = this.get();
        const routeKey = this._generateKey(wilaya1, wilaya2);
        
        const existingIndex = routes.findIndex(route => 
            this._generateKey(route.from, route.to) === routeKey
        );

        if (existingIndex >= 0) {
            routes.splice(existingIndex, 1);
        } else if (distance !== null) {
            routes.push({
                from: wilaya1,
                to: wilaya2,
                distance,
                savedAt: Date.now()
            });
        }

        try {
            localStorage.setItem(this._storageKey, JSON.stringify(routes));
            this.updateUI();
            return existingIndex < 0;
        } catch (e) {
            console.error('Saved routes save error:', e);
            return false;
        }
    },

    _generateKey(wilaya1, wilaya2) {
        return [wilaya1, wilaya2].sort().join('-');
    },

    updateUI() {
        const savedDiv = document.getElementById('saved-routes');
        const routes = this.get();

        if (routes.length === 0) {
            savedDiv.style.display = 'none';
            return;
        }

        const routesHTML = routes.map(route => `
            <div class="route-item" data-from="${route.from}" data-to="${route.to}">
                <div class="route-info">
                    <span class="route-cities">${route.from} ↔ ${route.to}</span>
                    <span class="route-distance">${route.distance} كم</span>
                </div>
                <button class="remove-saved" aria-label="إزالة من المحفوظات">×</button>
            </div>
        `).join('');

        savedDiv.innerHTML = `
            <h3>المسارات المحفوظة</h3>
            ${routesHTML}
        `;
        savedDiv.style.display = 'block';
    }
};

// API and Calculations
async function calculateDistance(start, end) {
    if (distanceCache.has(start, end)) {
        return distanceCache.get(start, end);
    }

    if (!apiUsage.canMakeRequest()) {
        const waitTime = apiUsage.getTimeUntilReset();
        const minutes = Math.floor(waitTime / 60);
        const seconds = waitTime % 60;
        const timeMsg = minutes > 0 ? 
            `${minutes} دقيقة و ${seconds} ثانية` : 
            `${seconds} ثانية`;
            
        throw new Error(`تم تجاوز الحد الأقصى للطلبات. يرجى الانتظار ${timeMsg} قبل المحاولة مرة أخرى.`);
    }

    const startCoords = wilayaData[start].coordinates;
    const endCoords = wilayaData[end].coordinates;

    try {
        const startStr = `${startCoords[1]},${startCoords[0]}`;
        const endStr = `${endCoords[1]},${endCoords[0]}`;

        const url = `${CONFIG.ORS_API_URL}?api_key=${CONFIG.ORS_API_KEY}&start=${startStr}&end=${endStr}`;
        
        const response = await fetch(url);
        apiUsage.increment();

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Error:', errorData);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.features && data.features[0] && data.features[0].properties) {
            const summary = data.features[0].properties.summary;
            
            if (!summary) {
                throw new Error('No route summary found in response');
            }

            const distance = Math.round(summary.distance / 1000);
            const duration = Math.round(summary.duration / 60);
            
            const routeData = { distance, duration };
            distanceCache.set(start, end, routeData);
            
            return routeData;
        }
        throw new Error('Invalid response format from API');
    } catch (error) {
        console.error('Error calculating distance:', error);
        throw error;
    }
}

function calculateRecommendedRate(distance) {
    // Define trip types and their boundaries
    const TRIP_TYPES = {
        SHORT: { maxDistance: 150, minRate: 3.5, maxRate: 5.0, typicalMin: 4.0, typicalMax: 4.5 },
        MEDIUM: { maxDistance: 400, minRate: 3.0, maxRate: 4.5, typicalMin: 3.5, typicalMax: 4.0 },
        LONG: { minDistance: 400, minRate: 2.5, maxRate: 3.5, typicalMin: 2.8, typicalMax: 3.2 }
    };

    // Determine trip type based on distance
    let tripType;
    if (distance <= TRIP_TYPES.SHORT.maxDistance) {
        tripType = TRIP_TYPES.SHORT;
    } else if (distance <= TRIP_TYPES.MEDIUM.maxDistance) {
        tripType = TRIP_TYPES.MEDIUM;
    } else {
        tripType = TRIP_TYPES.LONG;
    }

    // Linear interpolation within the trip type's range
    let rate;
    if (tripType === TRIP_TYPES.LONG) {
        // For long trips, use exponential decay to handle very long distances
        const DECAY_FACTOR = 0.001; // Gentler decay
        const baseRate = tripType.typicalMin;
        const excess = Math.max(0, distance - TRIP_TYPES.LONG.minDistance);
        rate = baseRate + (tripType.maxRate - baseRate) * Math.exp(-DECAY_FACTOR * excess);
    } else {
        // For short and medium trips, use linear interpolation within typical range
        const rangePosition = (distance - (tripType === TRIP_TYPES.SHORT ? 0 : TRIP_TYPES.SHORT.maxDistance)) / 
            (tripType.maxDistance - (tripType === TRIP_TYPES.SHORT ? 0 : TRIP_TYPES.SHORT.maxDistance));
        rate = tripType.typicalMax - (rangePosition * (tripType.typicalMax - tripType.typicalMin));
    }

    // Ensure rate stays within absolute min/max bounds for the trip type
    return Math.min(Math.max(rate, tripType.minRate), tripType.maxRate);
}

// UI Updates
function updateUI(wilaya1, wilaya2, routeData) {
    document.getElementById('start-wilaya').textContent = wilaya1;
    document.getElementById('end-wilaya').textContent = wilaya2;
    document.getElementById('distance-value').textContent = routeData.distance;

    const hours = Math.floor(routeData.duration / 60);
    const minutes = routeData.duration % 60;
    
    const timeString = hours > 0 
        ? `${hours} ساعة${minutes > 0 ? ` و ${minutes} دقيقة` : ''}`
        : `${minutes} دقيقة`;
    document.getElementById('time-value').textContent = timeString;

    const minPrice = Math.round(routeData.distance * CONFIG.MIN_RATE);
    const maxPrice = Math.round(routeData.distance * CONFIG.MAX_RATE);
    const recommendedRate = calculateRecommendedRate(routeData.distance);
    const recommendedPrice = Math.round((routeData.distance * recommendedRate) / 100) * 100;

    document.getElementById('min-price').textContent = `${minPrice.toLocaleString()} دج`;
    document.getElementById('max-price').textContent = `${maxPrice.toLocaleString()} دج`;
    document.getElementById('recommended-price').textContent = `${recommendedPrice.toLocaleString()} دج`;
}

// Event Handlers
async function handleRouteUpdate() {
    const wilaya1 = wilaya1Select.value;
    const wilaya2 = wilaya2Select.value;

    if (!wilaya1 || !wilaya2) return;

    if (wilaya1 === wilaya2) {
        showError("يرجى اختيار ولايتين مختلفتين");
        return;
    }

    showLoading(true);
    hideError();

    try {
        const routeData = await calculateDistance(wilaya1, wilaya2);
        updateUI(wilaya1, wilaya2, routeData);
        recentSearches.add(wilaya1, wilaya2, routeData.distance);
        showResult(true);
        updateRemainingAttempts();
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function handleShare() {
    const wilaya1 = wilaya1Select.value;
    const wilaya2 = wilaya2Select.value;
    const distance = document.getElementById('distance-value').textContent;
    
    const text = ` المسافة بين ${wilaya1} &nbsp; و ${wilaya2} &nbsp;هي &nbsp;${distance} &nbsp;كم`;
    
    if (navigator.share) {
        navigator.share({
            title: 'حاسبة المسافات بين الولايات',
            text: text,
            url: window.location.href
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(text)
            .then(() => showNotification('تم نسخ النص'))
            .catch(console.error);
    }
}

// Utility Functions
function showLoading(show) {
    document.getElementById('loading').classList.toggle('show', show);
}

function showResult(show) {
    document.getElementById('result').classList.toggle('show', show);
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    showResult(false);
}

function hideError() {
    document.getElementById('error').classList.remove('show');
}

function formatTimestamp(timestamp) {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - timestamp) / 1000);
    
    if (diffInSeconds < 60) {
        return 'الآن';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `منذ ${minutes} دقيقة`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `منذ ${hours} ساعة`;
    } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `منذ ${days} يوم`;
    }
}

// Function to show notifications
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
// Function to update remaining attempts display
function updateRemainingAttempts() {
    const remaining = apiUsage.getRemaining();
    const attemptsDiv = document.getElementById('remaining-attempts');
    
    if (remaining < apiUsage.requestLimit) {
        const timeUntilReset = apiUsage.getTimeUntilReset();
        const minutes = Math.floor(timeUntilReset / 60);
        const seconds = timeUntilReset % 60;
        attemptsDiv.innerHTML = `
            <div class="attempts-display">
                المحاولات المتبقية: ${remaining}
                <span class="reset-time">
                    (تجديد بعد ${minutes} دقيقة ${seconds > 0 ? `و ${seconds} ثانية` : ''})
                </span>
            </div>
        `;
    } else {
        attemptsDiv.innerHTML = `
            <div class="attempts-display">
                المحاولات المتبقية: ${remaining}
            </div>
        `;
    }
}

function openInGoogleMaps() {
    const wilaya1 = wilaya1Select.value;
    const wilaya2 = wilaya2Select.value;
    
    if (!wilaya1 || !wilaya2) {
        showNotification('يرجى اختيار ولايتين أولاً');
        return;
    }

    const start = wilayaData[wilaya1].coordinates;
    const end = wilayaData[wilaya2].coordinates;
    
    const url = `https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${end[0]},${end[1]}&travelmode=driving`;
    window.open(url, '_blank');
}

document.getElementById('share-button')?.addEventListener('click', handleShare);
document.getElementById('print-button')?.addEventListener('click', () => window.print());

document.getElem

function initializeApp() {
    apiUsage.init();
    distanceCache.init();
    
    // Add remaining attempts display
    const formDiv = document.getElementById('distance-form');
    const attemptsDiv = document.createElement('div');
    attemptsDiv.id = 'remaining-attempts';
    attemptsDiv.className = 'attempts-display';
    formDiv.insertAdjacentElement('afterend', attemptsDiv);
    
    // Add styles for the attempts display
    const styles = document.createElement('style');
    styles.textContent = `
        .attempts-display {
            text-align: center;
            margin: 10px 0;
            padding: 8px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 4px;
            font-size: 0.9em;
            color: var(--text-secondary);
        }
    `;
    document.head.appendChild(styles);
    
    // Initial update of attempts display
    updateRemainingAttempts();

    const wilayas = Object.keys(wilayaData);
    const fragment1 = document.createDocumentFragment();
    const fragment2 = document.createDocumentFragment();

    wilayas.forEach(wilaya => {
        const option1 = new Option(wilaya, wilaya);
        const option2 = new Option(wilaya, wilaya);
        fragment1.appendChild(option1);
        fragment2.appendChild(option2);
    });

    wilaya1Select.appendChild(fragment1);
    wilaya2Select.appendChild(fragment2);

    recentSearches.updateUI();
    savedRoutes.updateUI();

    const remaining = apiUsage.getRemaining();
    if (remaining < 3) {
        const timeUntilReset = apiUsage.getTimeUntilReset();
        const minutes = Math.floor(timeUntilReset / 60);
        showNotification(`تبقى ${remaining} طلبات فقط. سيتم تجديد الطلبات بعد ${minutes} دقيقة`);
    }

    if (!navigator.onLine) {
        document.getElementById('offline-notice').hidden = false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);

const wilaya1Select = document.getElementById('wilaya1');
const wilaya2Select = document.getElementById('wilaya2');

wilaya1Select.addEventListener('change', handleRouteUpdate);
wilaya2Select.addEventListener('change', handleRouteUpdate);

document.addEventListener('click', (e) => {
    if (e.target.closest('.recent-item')) {
        const item = e.target.closest('.recent-item');
        const fromWilaya = item.dataset.from;
        const toWilaya = item.dataset.to;
        
        wilaya1Select.value = fromWilaya;
        wilaya2Select.value = toWilaya;
        handleRouteUpdate();
    }

    if (e.target.closest('.route-item') && !e.target.classList.contains('remove-saved')) {
        const item = e.target.closest('.route-item');
        const fromWilaya = item.dataset.from;
        const toWilaya = item.dataset.to;
        
        wilaya1Select.value = fromWilaya;
        wilaya2Select.value = toWilaya;
        handleRouteUpdate();
    }

    if (e.target.classList.contains('remove-saved')) {
        const item = e.target.closest('.route-item');
        const fromWilaya = item.dataset.from;
        const toWilaya = item.dataset.to;
        
        savedRoutes.toggle(fromWilaya, toWilaya);
        showNotification('تم إزالة المسار من المحفوظات');
    }
});

document.getElementById('swap-button').addEventListener('click', () => {
    const temp = wilaya1Select.value;
    wilaya1Select.value = wilaya2Select.value;
    wilaya2Select.value = temp;
    if (wilaya1Select.value && wilaya2Select.value) {
        handleRouteUpdate();
    }
});

document.getElementById('share-button')?.addEventListener('click', handleShare);
document.getElementById('print-button')?.addEventListener('click', () => window.print());

// Function to show the map container
function showMapContainer() {
    const mapContainer = document.getElementById('map-container');
    mapContainer.style.display = 'block';
}

// Function to create and insert the map iframe
function createMapIframe(wilaya1, wilaya2) {
    const mapFrameContainer = document.getElementById('map-frame-container');
    mapFrameContainer.innerHTML = '<div class="text-center p-5">جاري تحميل الخريطة...</div>';
    
    try {
        // Get coordinates for both wilayas
        const coords1 = wilayaData[wilaya1].coordinates;
        const coords2 = wilayaData[wilaya2].coordinates;

        // Input validation
        if (!coords1 || !coords2) {
            throw new Error('إحداثيات غير صالحة');
        }

        // Prepare coordinates in the correct format [longitude, latitude]
        const start = [coords1[1], coords1[0]];
        const end = [coords2[1], coords2[0]];

        // Calculate bounding box
        let minLat = Math.min(coords1[0], coords2[0]);
        let maxLat = Math.max(coords1[0], coords2[0]);
        let minLon = Math.min(coords1[1], coords2[1]);
        let maxLon = Math.max(coords1[1], coords2[1]);

        // Add padding (20% for better visibility)
        const latDiff = maxLat - minLat;
        const lonDiff = maxLon - minLon;
        const latPadding = latDiff * 0.2;
        const lonPadding = lonDiff * 0.2;

        const bbox = [
            minLon - lonPadding,
            minLat - latPadding,
            maxLon + lonPadding,
            maxLat + latPadding
        ].join(',');

        // Create route URL using OSRM demo server
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${start.join(',')};${end.join(',')}?overview=full&geometries=geojson`;

        // Fetch route data
        fetch(routeUrl)
            .then(response => response.json())
            .then(data => {
                if (data.routes && data.routes[0]) {
                    const route = data.routes[0].geometry.coordinates;
                    
                    // Create a new map container for Leaflet
                    mapFrameContainer.innerHTML = `
                        ${createRouteInfoTable(wilaya1, wilaya2)}
                        <div id="map" style="height: 450px; border-radius: 8px;"></div>
                    `;

                    // Initialize Leaflet map
                    const map = L.map('map').fitBounds([
                        [minLat - latPadding, minLon - lonPadding],
                        [maxLat + latPadding, maxLon + lonPadding]
                    ]);

                    // Add OpenStreetMap tiles
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(map);

                    // Add markers
                    L.marker([coords1[0], coords1[1]]).addTo(map)
                        .bindPopup(wilaya1);
                    L.marker([coords2[0], coords2[1]]).addTo(map)
                        .bindPopup(wilaya2);
            map.on('load', function() {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            });

            window.addEventListener('resize', () => {
                map.invalidateSize();
            });
                    // Draw route
                    L.polyline(route.map(coord => [coord[1], coord[0]]), {
                        color: '#0078A8',
                        weight: 4,
                        opacity: 0.7
                    }).addTo(map);

                    // Add external links
                    addExternalLinks(mapFrameContainer, bbox, coords1, coords2);
                }
            })
            .catch(error => {
                console.error('Error fetching route:', error);
                showError(mapFrameContainer, error);
            });

    } catch (error) {
        console.error('Error creating map:', error);
        showError(mapFrameContainer, error);
    }
}
// Helper function to create route info table
function createRouteInfoTable(wilaya1, wilaya2) {
    return `
        <div class="result-section" dir="rtl">
            <h3 class="result-title">معلومات المسار</h3>
            <div class="price-info">
                <div class="price-row">
                    <span>نقطة الانطلاق:</span>
                    <strong>${wilaya1}</strong>
                </div>
                <div class="price-row">
                    <span>نقطة الوصول:</span>
                    <strong>${wilaya2}</strong>
                </div>
                <div class="price-row">
                    <span>المسافة التقريبية:</span>
                    <strong>${document.getElementById('distance-value').textContent} كم</strong>
                </div>
                <div class="price-row">
                    <span>الوقت التقريبي:</span>
                    <strong>${document.getElementById('time-value').textContent}</strong>
                </div>
            </div>
        </div>
    `;
}
// Helper function to add external links
function addExternalLinks(container, bbox, coords1, coords2) {
    const links = `
        <div class="actions" dir="rtl">
            <a href="https://www.openstreetmap.org/?bbox=${bbox}&layer=mapnik" 
               target="_blank" 
               class="action-button">
               👁️ عرض على OpenStreetMap
            </a>

            <a href="https://www.google.com/maps/dir/${coords1[0]},${coords1[1]}/${coords2[0]},${coords2[1]}" 
               target="_blank" 
               class="action-button">
               🗺️ عرض في خرائط Google
            </a>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', links);
}

// Helper function to show errors
function showError(container, error) {
    container.innerHTML = `
        <div class="error show">
            <p>عذراً، حدث خطأ أثناء تحميل الخريطة.</p>
            <p>الرجاء المحاولة مرة أخرى لاحقاً.</p>
            <p class="error-details">${error.message}</p>
        </div>
    `;
}

// Helper function to calculate bounding box
function calculateBoundingBox(coordinates) {
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    coordinates.forEach(coord => {
        minLon = Math.min(minLon, coord[0]);
        maxLon = Math.max(maxLon, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
    });

    // Add padding (10%)
    const lonPadding = (maxLon - minLon) * 0.1;
    const latPadding = (maxLat - minLat) * 0.1;

    return `${minLon-lonPadding},${minLat-latPadding},${maxLon+lonPadding},${maxLat+latPadding}`;
}

// Update map button event listener
document.getElementById('map-button')?.addEventListener('click', () => {
    const wilaya1 = wilaya1Select.value;
    const wilaya2 = wilaya2Select.value;
    
    if (!wilaya1 || !wilaya2) {
        showNotification('يرجى اختيار ولايتين أولاً');
        return;
    }
    
    if (wilaya1 === wilaya2) {
        showNotification('يرجى اختيار ولايتين مختلفتين');
        return;
    }
    
    showMapContainer();
    createMapIframe(wilaya1, wilaya2);
});

// Close map button event listener
document.getElementById('close-map')?.addEventListener('click', () => {
    const mapContainer = document.getElementById('map-container');
    mapContainer.style.display = 'none';
});

// Helper function to calculate bounding box
function calculateBoundingBox(coordinates) {
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    coordinates.forEach(coord => {
        minLon = Math.min(minLon, coord[0]);
        maxLon = Math.max(maxLon, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLat = Math.max(maxLat, coord[1]);
    });

    const padding = 0.1;
    return `${minLon-padding},${minLat-padding},${maxLon+padding},${maxLat+padding}`;
}
document.getElementById('save-button')?.addEventListener('click', () => {
    const wilaya1 = wilaya1Select.value;
    const wilaya2 = wilaya2Select.value;
    const distance = parseInt(document.getElementById('distance-value').textContent);
    
    if (wilaya1 && wilaya2 && distance) {
        const isSaved = savedRoutes.toggle(wilaya1, wilaya2, distance);
        showNotification(isSaved ? 'تم حفظ المسار' : 'تم إزالة المسار من المحفوظات');
    }
});

// Handle offline/online status
window.addEventListener('online', () => {
    document.getElementById('offline-notice').hidden = true;
    showNotification('تم استعادة الاتصال بالإنترنت');
});

window.addEventListener('offline', () => {
    document.getElementById('offline-notice').hidden = false;
    showNotification('أنت الآن في وضع غير متصل');
});

// Add notification styles if not already in CSS
const notificationStyles = `
.notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 1000;
    animation: fadeInOut 3s ease;
}

@keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, 20px); }
    15% { opacity: 1; transform: translate(-50%, 0); }
    85% { opacity: 1; transform: translate(-50%, 0); }
    100% { opacity: 0; transform: translate(-50%, -20px); }
}
`;

// Add notification styles to document
if (!document.getElementById('notification-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'notification-styles';
    styleSheet.textContent = notificationStyles;
    document.head.appendChild(styleSheet);
}

const newStyles = `
<style>
/* Center text in table cells */
.text-center {
    text-align: center;
}

.price-row {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
}

.result-title {
    text-align: center;
    color: var(--primary-color);
    margin-bottom: 1.5rem;
}

/* Close button styling */
.close-map-btn, .remove-saved {
    background: var(--primary-light);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--primary-color);
    font-size: 1.2rem;
    transition: all var(--transition-speed);
}

.close-map-btn:hover, .remove-saved:hover {
    background: var(--primary-color);
    color: white;
    transform: scale(1.1);
}

/* Adjust the map header */
.map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: var(--primary-light);
    border-bottom: 1px solid var(--border-color);
}

/* Distance result styling */
.distance-result {
    text-align: center;
    margin: 2rem 0;
    font-size: 1.5rem;
    color: var(--primary-color);
}

.distance-result strong {
    display: block;
    margin-top: 0.5rem;
    font-size: 2rem;
}
</style>
`;

// Add the styles to the document head
document.head.insertAdjacentHTML('beforeend', newStyles);
