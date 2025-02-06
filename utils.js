// utils.js
class ErrorTracker {
    static init() {
        window.addEventListener('error', this.handleError);
        window.addEventListener('unhandledrejection', this.handlePromiseError);
    }

    static handleError(event) {
        const error = {
            message: event.message,
            source: event.filename,
            line: event.lineno,
            column: event.colno,
            stack: event.error?.stack,
            timestamp: new Date().toISOString()
        };

        ErrorTracker.logError(error);
    }

    static handlePromiseError(event) {
        const error = {
            message: event.reason?.message || 'Unhandled Promise Rejection',
            stack: event.reason?.stack,
            timestamp: new Date().toISOString()
        };

        ErrorTracker.logError(error);
    }

    static logError(error) {
        // Store error in localStorage for later analysis
        const errors = JSON.parse(localStorage.getItem('error_logs') || '[]');
        errors.push(error);
        // Keep only last 50 errors
        if (errors.length > 50) errors.shift();
        localStorage.setItem('error_logs', JSON.stringify(errors));

        // You could also send to a server here
        console.error('Application Error:', error);
    }
}

class Analytics {
    static init() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.events = [];
    }

    static trackEvent(category, action, label = null, value = null) {
        const event = {
            category,
            action,
            label,
            value,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        this.events.push(event);
        this.saveEvents();
    }

    static trackTiming(category, variable, time) {
        const timing = {
            category,
            variable,
            time,
            timestamp: Date.now(),
            sessionId: this.sessionId
        };

        this.saveTimings(timing);
    }

    static generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    static saveEvents() {
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        events.push(...this.events);
        // Keep only last 100 events
        if (events.length > 100) events.splice(0, events.length - 100);
        localStorage.setItem('analytics_events', JSON.stringify(events));
        this.events = [];
    }

    static saveTimings(timing) {
        const timings = JSON.parse(localStorage.getItem('analytics_timings') || '[]');
        timings.push(timing);
        // Keep only last 50 timings
        if (timings.length > 50) timings.shift();
        localStorage.setItem('analytics_timings', JSON.stringify(timings));
    }
}

// Performance monitoring
class PerformanceMonitor {
    static init() {
        if ('PerformanceObserver' in window) {
            // Monitor long tasks
            const longTaskObserver = new PerformanceObserver(list => {
                list.getEntries().forEach(entry => {
                    Analytics.trackTiming('Performance', 'LongTask', entry.duration);
                });
            });
            
            longTaskObserver.observe({ entryTypes: ['longtask'] });

            // Monitor layout shifts
            const layoutShiftObserver = new PerformanceObserver(list => {
                list.getEntries().forEach(entry => {
                    if (!entry.hadRecentInput) {
                        Analytics.trackTiming('Performance', 'LayoutShift', entry.value);
                    }
                });
            });

            layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        }
    }

    static measureApiCall(startTime, endTime) {
        const duration = endTime - startTime;
        Analytics.trackTiming('API', 'RequestDuration', duration);
    }
}

// Initialize
ErrorTracker.init();
Analytics.init();
PerformanceMonitor.init();

// Export utilities
export {
    ErrorTracker,
    Analytics,
    PerformanceMonitor
};