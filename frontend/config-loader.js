// Config Loader - fetches runtime-config.json and exposes values globally
// This script must be loaded before auth.js and app.js

(function() {
    'use strict';

    // Synchronous XHR to ensure config is available before other scripts run
    // This is intentionally synchronous because auth.js and app.js depend on the config
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'runtime-config.json', false); // synchronous
        xhr.send();

        if (xhr.status === 200) {
            window.WA_CONFIG = JSON.parse(xhr.responseText);
            console.log('Runtime config loaded successfully:', window.WA_CONFIG);
        } else {
            console.error('Failed to load runtime-config.json:', xhr.status, xhr.statusText);
            window.WA_CONFIG = null;
        }
    } catch (error) {
        console.error('Error loading runtime-config.json:', error);
        window.WA_CONFIG = null;
    }
})();
