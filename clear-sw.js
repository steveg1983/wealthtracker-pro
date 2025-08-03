// Copy and paste this entire script into the browser console

(async function clearServiceWorker() {
    console.log('Starting service worker cleanup...');
    
    try {
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log(`Found ${registrations.length} service worker(s)`);
            
            for (let registration of registrations) {
                const success = await registration.unregister();
                console.log(`Unregistered SW at ${registration.scope}: ${success}`);
            }
        }
        
        // Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log(`Found ${cacheNames.length} cache(s)`);
            
            for (let name of cacheNames) {
                const success = await caches.delete(name);
                console.log(`Deleted cache "${name}": ${success}`);
            }
        }
        
        console.log('✅ Service worker cleanup complete!');
        console.log('Please refresh the page now.');
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
})();