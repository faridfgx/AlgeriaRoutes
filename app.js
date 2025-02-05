const ORS_API_KEY = '5b3ce3597851110001cf62486bcb783b711d46cbaaa5196c2c053ee6';
const ORS_API_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';

async function calculateDistance(start, end) {
    const startCoords = wilayaData[start].coordinates;
    const endCoords = wilayaData[end].coordinates;

    const url = `${ORS_API_URL}?api_key=${ORS_API_KEY}&start=${startCoords[1]},${startCoords[0]}&end=${endCoords[1]},${endCoords[0]}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.features && data.features[0]) {
            return Math.round(data.features[0].properties.segments[0].distance / 1000);
        }
        throw new Error('No route found');
    } catch (error) {
        console.error('Error calculating distance:', error);
        throw error;
    }
}

// DOM Elements
const wilaya1Select = document.getElementById('wilaya1');
const wilaya2Select = document.getElementById('wilaya2');
const resultDiv = document.getElementById('result');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const startWilayaSpan = document.getElementById('start-wilaya');
const endWilayaSpan = document.getElementById('end-wilaya');
const distanceValueSpan = document.getElementById('distance-value');
const timeValueSpan = document.getElementById('time-value');
const minPriceSpan = document.getElementById('min-price');
const maxPriceSpan = document.getElementById('max-price');
const recommendedPriceSpan = document.getElementById('recommended-price');

// Populate dropdowns
Object.keys(wilayaData).forEach(wilaya => {
    wilaya1Select.add(new Option(wilaya, wilaya));
    wilaya2Select.add(new Option(wilaya, wilaya));
});

function calculateRecommendedRate(distance) {
    // Constants for price calculation
    const MIN_RATE = 3; // Minimum rate per km
    const MAX_RATE = 9; // Maximum rate per km
    
    // Parameters for the exponential decay
    const DECAY_FACTOR = 0.007; // Controls how quickly the rate drops
    const MIDPOINT = 40; // Distance at which we want rate to be closer to maximum
    
    // Calculate the rate using exponential decay
    const decayComponent = Math.exp(-DECAY_FACTOR * (distance - MIDPOINT));
    const rate = MIN_RATE + (MAX_RATE - MIN_RATE) * decayComponent;
    
    // Return the calculated rate, bounded between MIN_RATE and MAX_RATE
    return Math.min(Math.max(rate, MIN_RATE), MAX_RATE);
}

async function updateDistance() {
    const wilaya1 = wilaya1Select.value;
    const wilaya2 = wilaya2Select.value;

    if (wilaya1 && wilaya2) {
        if (wilaya1 === wilaya2) {
            resultDiv.classList.remove('show');
            errorDiv.textContent = "يرجى اختيار ولايتين مختلفتين";
            errorDiv.classList.add('show');
            return;
        }

        loadingDiv.classList.add('show');
        resultDiv.classList.remove('show');
        errorDiv.classList.remove('show');

        try {
            const distance = await calculateDistance(wilaya1, wilaya2);
            startWilayaSpan.textContent = wilaya1;
            endWilayaSpan.textContent = wilaya2;
            distanceValueSpan.textContent = distance;
            
            // Calculate travel time (assuming average speed of 50 km/h)
            const timeInHours = distance / 50;
            const hours = Math.floor(timeInHours);
            const minutes = Math.round((timeInHours - hours) * 60);
            
            // Format time string
            let timeString = '';
            if (hours > 0) {
                timeString += `${hours} ساعة`;
                if (minutes > 0) {
                    timeString += ` و ${minutes} دقيقة`;
                }
            } else {
                timeString = `${minutes} دقيقة`;
            }
            timeValueSpan.textContent = timeString;
            
            // Calculate min and max prices
            const minPrice = Math.round(distance * 3); // 3 DA per km
            const maxPrice = Math.round(distance * 9); // 9 DA per km
                        // Calculate recommended price
            const recommendedRate = calculateRecommendedRate(distance);
            const exactPrice = distance * recommendedRate;
            // Round to nearest hundred
            const recommendedPrice = Math.round(exactPrice / 100) * 100;

            
            minPriceSpan.textContent = `${minPrice.toLocaleString()} دج`;
            maxPriceSpan.textContent = `${maxPrice.toLocaleString()} دج`;
            recommendedPriceSpan.textContent = `${recommendedPrice.toLocaleString()} دج`;
            loadingDiv.classList.remove('show');
            resultDiv.classList.add('show');
        } catch (error) {
            loadingDiv.classList.remove('show');
            errorDiv.textContent = "عذراً، حدث خطأ أثناء حساب المسافة. يرجى المحاولة مرة أخرى.";
            errorDiv.classList.add('show');
        }
    } else {
        resultDiv.classList.remove('show');
        errorDiv.classList.remove('show');
    }
}

wilaya1Select.addEventListener('change', updateDistance);
wilaya2Select.addEventListener('change', updateDistance);