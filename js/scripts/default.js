/**
 * Enhanced Port Health Check and Monitoring System
 * Automatically detects and monitors ports until they respond with valid HTTP codes
 */

class PortMonitor {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 30;
        this.initialDelayMs = options.initialDelayMs || 1000;
        this.maxDelayMs = options.maxDelayMs || 10000;
        this.backoffMultiplier = options.backoffMultiplier || 1.5;
        this.successCodes = options.successCodes || [200, 201, 202, 204, 301, 302, 304];
        this.monitoringActive = new Map();
        this.statusPanel = null;
        this.loaded = false;
        this.setupUI().then();
        this.setupToasterListener();
    }

    async setupUI() {
        try {
            // Create a monitoring status panel
            const statusPanel = document.createElement('div');
            statusPanel.id = 'port-monitor-status';
            statusPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10001;
            max-width: 300px;
            max-height: 200px;
            overflow-y: auto;
            display: none;
        `;

            document.body.appendChild(statusPanel);
            this.statusPanel = statusPanel;
            this.loaded = true
        } catch (e) {
            this.loaded = false;
        }
    }

    async checkedSetupUI() {
        if (!this.loaded) {
            await this.setupUI();
        }
    }

    updateStatus(url, status, attempt = 0) {
        this.checkedSetupUI().then(() => {});

        const statusId = `status-${url.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let statusElement = document.getElementById(statusId);

        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = statusId;
            this.statusPanel.appendChild(statusElement);
            this.statusPanel.style.display = 'block';
        }

        const timestamp = new Date().toLocaleTimeString();
        const statusColor = status === 'success' ? '#4CAF50' :
                           status === 'error' ? '#f44336' :
                           status === 'checking' ? '#2196F3' : '#FF9800';

        statusElement.innerHTML = `
            <div style="color: ${statusColor}; margin-bottom: 5px;">
                <strong>${url}</strong><br>
                ${status.toUpperCase()} ${attempt > 0 ? `(attempt ${attempt})` : ''}<br>
                <small>${timestamp}</small>
            </div>
        `;

        if (status === 'success') {
            setTimeout(() => {
                if (statusElement.parentNode) {
                    statusElement.remove();
                    if (this.statusPanel.children.length === 0) {
                        this.statusPanel.style.display = 'none';
                    }
                }
            }, 3000);
        }
    }

    async checkPort(url, attempt = 1) {
        this.updateStatus(url, 'checking', attempt);

        try {
            // Use fetch with timeout for health check
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            await fetch(url, {
                method: 'HEAD', // Use HEAD to minimize data transfer
                signal: controller.signal,
                mode: 'no-cors', // Handle CORS issues
                cache: 'no-cache'
            });

            clearTimeout(timeoutId);

            // For no-cors mode, we can't read the status, so we assume success if no error
            this.updateStatus(url, 'success');
            console.log(`✅ Port check successful for ${url}`);
            return true;

        } catch (error) {
            // Try with a simple image request as fallback
            try {
                const img = new Image();
                const imgPromise = new Promise((resolve, reject) => {
                    img.onload = () => resolve(true);
                    img.onerror = () => reject(new Error('Image load failed'));
                    setTimeout(() => reject(new Error('Timeout')), 5000);
                });

                img.src = `${url}/favicon.ico?_t=${Date.now()}`;
                await imgPromise;

                this.updateStatus(url, 'success');
                console.log(`✅ Port check successful for ${url} (via image)`);
                return true;

            } catch (imgError) {
                //console.log(`❌ Port check failed for ${url} (attempt ${attempt}):`, error.message);
                this.updateStatus(url, 'error', attempt);
                return false;
            }
        }
    }

    calculateDelay(attempt) {
        const delay = Math.min(
            this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1),
            this.maxDelayMs
        );
        return delay + Math.random() * this.maxDelayMs; // Add jitter
    }

    async monitorPort(url) {
        if (this.monitoringActive.get(url)) {
            console.log(`Already monitoring ${url}`);
            return;
        }

        this.monitoringActive.set(url, true);
        console.log(`🔍 Starting port monitoring for ${url}`);

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            if (!this.monitoringActive.get(url)) {
                console.log(`Monitoring stopped for ${url}`);
                break;
            }
            const success = await this.checkPort(url, attempt);

            if (success) {
                this.monitoringActive.set(url, false);
                console.log(`✅ Port ${url} is now responding successfully`);
                break;
            }

            if (attempt < this.maxRetries) {
                const delay = this.calculateDelay(attempt);
                //console.log(`⏳ Waiting ${Math.round(delay)}ms before retry ${attempt + 1} for ${url}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.warn(`⚠️ Max retries reached for ${url}`);
                this.updateStatus(url, 'failed');
            }
            await new Promise(resolve => setTimeout(resolve, 0));

        }

        this.monitoringActive.set(url, false);
    }

    stopMonitoring(url) {
        this.monitoringActive.set(url, false);
        console.log(`🛑 Stopped monitoring ${url}`);
    }

    stopAllMonitoring() {
        for (const url of this.monitoringActive.keys()) {
            this.monitoringActive.set(url, false);
        }
        console.log('🛑 Stopped all port monitoring');
    }

    async monitorPorts(urls) {
        console.log('🚀 Starting enhanced port monitoring system');
        console.log('URLs to monitor:', urls);

        // Start monitoring all URLs concurrently
        const monitoringPromises = urls.map(url => this.monitorPort(url));

        try {
            await Promise.allSettled(monitoringPromises);
            console.log('✅ Port monitoring completed for all URLs');
        } catch (error) {
            console.error('❌ Error in port monitoring:', error);
        }
    }

    async default() {
        await this.monitorPorts(
            [':9100', ':10101', ':10100']
                .map(port => `${window.location.protocol}//${window.location.hostname}${port}`)
        );
    }

    setupToasterListener() {
        // Listener für Toaster-Benachrichtigungen von Background Script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'showToaster') {
                this.showToaster(request.data);
                sendResponse({ success: true });
            }
        });
    }

    showToaster(data) {
        const { title, message, type, url } = data;

        // Erstelle Toaster-Container falls nicht vorhanden
        if (!document.getElementById('unsucknport-toaster-container')) {
            const container = document.createElement('div');
            container.id = 'unsucknport-toaster-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 999999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const container = document.getElementById('unsucknport-toaster-container');
        const toaster = document.createElement('div');
        const toasterId = 'toaster-' + Date.now();

        // Toaster-Styling basierend auf Typ
        const typeColors = {
            success: { bg: '#4CAF50', icon: '✅' },
            warning: { bg: '#FF9800', icon: '⚠️' },
            error: { bg: '#f44336', icon: '❌' },
            info: { bg: '#2196F3', icon: 'ℹ️' }
        };

        const colors = typeColors[type] || typeColors.info;

        toaster.id = toasterId;
        toaster.style.cssText = `
            background: ${colors.bg};
            color: white;
            padding: 16px 20px;
            margin-bottom: 10px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 300px;
            max-width: 400px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
            cursor: ${url ? 'pointer' : 'default'};
            position: relative;
            overflow: hidden;
        `;

        toaster.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="font-size: 20px; flex-shrink: 0; margin-top: 2px;">${colors.icon}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; word-wrap: break-word;">${title}</div>
                    <div style="font-size: 13px; opacity: 0.95; line-height: 1.4; word-wrap: break-word;">${message}</div>
                    ${url ? '<div style="font-size: 11px; opacity: 0.8; margin-top: 6px;">Klicken zum Öffnen</div>' : ''}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: rgba(255,255,255,0.3);
                    border: none;
                    color: white;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                ">×</button>
            </div>
            <div style="
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255,255,255,0.3);
                width: 100%;
                transform-origin: left;
                animation: unsucknport-shrink 5s linear forwards;
            "></div>
        `;

        // URL-Click Handler
        if (url) {
            toaster.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    window.open(url, '_blank');
                    toaster.remove();
                }
            });
        }

        container.appendChild(toaster);

        // CSS für Progress-Bar Animation hinzufügen
        if (!document.getElementById('unsucknport-toaster-styles')) {
            const style = document.createElement('style');
            style.id = 'unsucknport-toaster-styles';
            style.textContent = `
                @keyframes unsucknport-shrink {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `;
            document.head.appendChild(style);
        }

        // Animation einblenden
        requestAnimationFrame(() => {
            toaster.style.opacity = '1';
            toaster.style.transform = 'translateX(0)';
        });

        // Auto-Remove nach 5 Sekunden
        setTimeout(() => {
            if (toaster.parentNode) {
                toaster.style.opacity = '0';
                toaster.style.transform = 'translateX(100%)';
                setTimeout(() => toaster.remove(), 300);
            }
        }, 5000);
    }
}

// Initialize and start monitoring
const monitor = new PortMonitor({
    maxRetries: 250,
    initialDelayMs: 5000,
    maxDelayMs: 25,
    backoffMultiplier: 1
});

// Make monitor available globally for debugging
window.portMonitor = monitor;
document.portMonitor = monitor;

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    monitor.stopAllMonitoring();
});

let button = null;

// Query the document to be fully loaded before starting
async function onDocumentReady() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        if (!button) {
            setTimeout(() => {
            }, 5000);
            button = document.createElement('button');
            button.id = 'port-monitor-button';
            button.textContent = 'Start Port Monitor';
            button.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #2196F3;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            font-family: sans-serif;
            font-size: 14px;
            cursor: pointer;
            z-index: 10001;
        `;

            button.onclick = async () => {
                //monitor.default().then();
                button.disabled = true;
                button.textContent = 'Monitoring...';
                setTimeout(() => {
                    if (button.parentNode) {
                        button.remove();
                    }
                }, 5000);
            };

            document.body.appendChild(button);
        }
    } else {
        setTimeout(onDocumentReady, 100);
    }
}

onDocumentReady();
