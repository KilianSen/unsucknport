/**
 * WebSocket Client für Browser Extension
 * Verbindet sich mit externem WebSocket-Server und zeigt Nachrichten als Benachrichtigungen an
 */

class WebSocketNotificationClient {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.reconnectDelay = 5000; // 5 Sekunden
        this.serverUrl = 'ws://localhost:25566'; // Standard WebSocket Port
        this.notificationCount = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;

        this.init();
    }

    init() {
        console.log('WebSocket Notification Client wird initialisiert...');

        // Lade gespeicherte Server-URL
        this.loadSettings();

        // Verbinde mit WebSocket Server
        this.connectToWebSocket();

        // Event Listener für Extension-Nachrichten
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Async response
        });
    }

    loadSettings() {
        chrome.storage.sync.get({
            wsServerUrl: 'ws://localhost:25566'
        }, (items) => {
            this.serverUrl = items.wsServerUrl;
            console.log(`WebSocket Server URL geladen: ${this.serverUrl}`);
        });
    }

    handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'getWebSocketStatus':
                sendResponse({
                    connected: this.isConnected,
                    serverUrl: this.serverUrl,
                    notificationCount: this.notificationCount,
                    reconnectAttempts: this.reconnectAttempts,
                    maxReconnectAttempts: this.maxReconnectAttempts
                });
                break;

            case 'reconnectWebSocket':
                this.reconnect();
                sendResponse({ success: true });
                break;

            case 'updateServerUrl':
                this.updateServerUrl(request.url);
                sendResponse({ success: true });
                break;

            case 'sendTestMessage':
                this.sendTestMessage();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ error: 'Unknown action' });
        }
    }

    connectToWebSocket() {
        try {
            console.log(`Verbinde zu WebSocket Server: ${this.serverUrl}`);

            // Bestehende Verbindung schließen
            if (this.websocket) {
                this.websocket.close();
            }

            this.websocket = new WebSocket(this.serverUrl);

            this.websocket.onopen = (event) => {
                console.log('WebSocket Verbindung hergestellt');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.clearReconnectInterval();

                // Zeige Verbindungs-Benachrichtigung
                this.showNotification(
                    'WebSocket Verbunden',
                    `Erfolgreich mit ${this.serverUrl} verbunden`,
                    'success'
                );
            };

            this.websocket.onmessage = (event) => {
                console.log('WebSocket Nachricht erhalten:', event.data);
                this.handleIncomingMessage(event.data);
            };

            this.websocket.onclose = (event) => {
                console.log('WebSocket Verbindung geschlossen', event);
                this.isConnected = false;

                if (event.code !== 1000) { // Nicht normal geschlossen
                    this.scheduleReconnect();
                }
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket Fehler:', error);
                this.isConnected = false;
                this.scheduleReconnect();
            };

        } catch (error) {
            console.error('Fehler beim Erstellen der WebSocket Verbindung:', error);
            this.scheduleReconnect();
        }
    }

    handleIncomingMessage(messageData) {
        try {
            // Versuche JSON zu parsen, falls strukturierte Daten gesendet werden
            let parsedData;
            try {
                parsedData = JSON.parse(messageData);
            } catch (e) {
                // Falls kein JSON, behandle als einfachen String
                parsedData = { message: messageData };
            }

            // Extrahiere Titel und Nachricht
            const title = parsedData.title || 'WebSocket Nachricht';
            const message = parsedData.message || messageData;
            const type = parsedData.type || 'info';
            const url = parsedData.url || null;

            // Zeige Benachrichtigung
            this.showNotification(title, message, type, url);

            this.notificationCount++;

        } catch (error) {
            console.error('Fehler beim Verarbeiten der WebSocket Nachricht:', error);
        }
    }

    sendTestMessage() {
        if (this.isConnected && this.websocket) {
            const testMessage = {
                title: 'Test von Extension',
                message: `Test-Nachricht von Client - ${new Date().toLocaleTimeString()}`,
                type: 'info'
            };

            try {
                this.websocket.send(JSON.stringify(testMessage));
                console.log('Test-Nachricht an Server gesendet');

                // Lokale Benachrichtigung zur Bestätigung
                this.showNotification(
                    'Test gesendet',
                    'Test-Nachricht an WebSocket Server gesendet',
                    'info'
                );
            } catch (error) {
                console.error('Fehler beim Senden der Test-Nachricht:', error);
                this.showNotification(
                    'Fehler',
                    'Test-Nachricht konnte nicht gesendet werden',
                    'error'
                );
            }
        } else {
            this.showNotification(
                'Nicht verbunden',
                'Keine aktive WebSocket-Verbindung',
                'warning'
            );
        }
    }

    showNotification(title, message, type = 'info', url = null, background = null) {
        // Sende Nachricht an Content Script für Toaster-Anzeige
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'showToaster',
                    data: {
                        title: title,
                        message: message,
                        type: type,
                        url: url,
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Content Script nicht verfügbar, injiziere Toaster-Code...');
                        this.injectToasterCode(tabs[0].id, { title, message, type, url, background });
                    } else {
                        console.log('Toaster-Benachrichtigung gesendet an aktiven Tab');
                    }
                });
            }
        });

        this.notificationCount++;
    }

    injectToasterCode(tabId, notificationData) {
        // Escape spezielle Zeichen für String-Interpolation
        const escapedTitle = (notificationData.title || '').replace(/'/g, "\\'").replace(/`/g, "\\`");
        const escapedMessage = (notificationData.message || '').replace(/'/g, "\\'").replace(/`/g, "\\`");
        const escapedType = (notificationData.type || 'info').replace(/'/g, "\\'");
        const escapedUrl = notificationData.url ? `'${notificationData.url.replace(/'/g, "\\'")}'` : 'null';
        const escapedBackground = notificationData.background ? `'${notificationData.background.replace(/'/g, "\\'")}'` : 'null';

        // Injiziere Toaster-CSS und JavaScript direkt in die Seite
        const toasterCode = `
            // Erstelle Toaster-Container falls nicht vorhanden
            if (!document.getElementById('unsucknport-toaster-container')) {
                const container = document.createElement('div');
                container.id = 'unsucknport-toaster-container';
                container.style.cssText = \`
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    pointer-events: none;
                \`;
                document.body.appendChild(container);
            }

            // Funktion zum Anzeigen von Toaster-Benachrichtigungen
            function showUnSuckNPortToaster(title, message, type, url, background) {
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
                toaster.style.cssText = \`
                    background: \${colors.bg};
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
                    cursor: \${url ? 'pointer' : 'default'};
                    position: relative;
                    overflow: hidden;
                \`;
                
                
                if (background) {
                    // Load background image from url or base64 str
                    let addendum = \`
                        background-image: url('\${background}');
                        background-size: cover;
                        background-position: center;
                        color: white;
                    \`;
                    toaster.style.cssText += addendum;
                }
                
                toaster.innerHTML = \`
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="font-size: 20px; flex-shrink: 0; margin-top: 2px;">\${colors.icon}</div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; word-wrap: break-word;">\${title}</div>
                            <div style="font-size: 13px; opacity: 0.95; line-height: 1.4; word-wrap: break-word;">\${message}</div>
                            \${url ? '<div style="font-size: 11px; opacity: 0.8; margin-top: 6px;">Klicken zum Öffnen</div>' : ''}
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
                        animation: shrink 5s linear forwards;
                    "></div>
                \`;
                
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
            
            // CSS für Progress-Bar Animation
            if (!document.getElementById('unsucknport-toaster-styles')) {
                const style = document.createElement('style');
                style.id = 'unsucknport-toaster-styles';
                style.textContent = \`
                    @keyframes shrink {
                        from { transform: scaleX(1); }
                        to { transform: scaleX(0); }
                    }
                \`;
                document.head.appendChild(style);
            }
            
            // Zeige Toaster
            showUnSuckNPortToaster('${escapedTitle}', '${escapedMessage}', '${escapedType}', ${escapedUrl}, ${escapedBackground});
        `;

        chrome.tabs.executeScript(tabId, { code: toasterCode }, (result) => {
            if (chrome.runtime.lastError) {
                console.error('Fehler beim Injizieren des Toaster-Codes:', chrome.runtime.lastError);
            } else {
                console.log('Toaster-Benachrichtigung erfolgreich injiziert');
            }
        });
    }

    scheduleReconnect() {
        if (this.reconnectInterval || this.reconnectAttempts >= this.maxReconnectAttempts) {
            return; // Bereits geplant oder max. Versuche erreicht
        }

        this.reconnectAttempts++;
        console.log(`WebSocket Reconnect Versuch ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay / 1000} Sekunden...`);

        this.reconnectInterval = setTimeout(() => {
            this.reconnect();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000);
    }

    clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearTimeout(this.reconnectInterval);
            this.reconnectInterval = null;
        }
        // Reset delay
        this.reconnectDelay = 5000;
    }

    reconnect() {
        this.clearReconnectInterval();

        if (this.websocket) {
            this.websocket.close();
        }

        this.connectToWebSocket();
    }

    updateServerUrl(newUrl) {
        if (newUrl && newUrl !== this.serverUrl) {
            this.serverUrl = newUrl;

            // Speichere neue URL
            chrome.storage.sync.set({ wsServerUrl: newUrl });

            // Reconnect mit neuer URL
            this.reconnect();

            console.log(`Server URL aktualisiert: ${newUrl}`);
        }
    }

    disconnect() {
        this.clearReconnectInterval();

        if (this.websocket) {
            this.websocket.close(1000, 'Extension shutdown'); // Normal closure
            this.websocket = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
    }
}

// Initialisiere den WebSocket Client beim Laden der Extension
const wsClient = new WebSocketNotificationClient();

// Cleanup beim Entladen
chrome.runtime.onSuspend.addListener(() => {
    wsClient.disconnect();
});
