document.addEventListener('DOMContentLoaded', function() {
    const quickMonitorBtn = document.getElementById('quick-monitor');
    const monitorCustomBtn = document.getElementById('monitor-custom');
    const stopAllBtn = document.getElementById('stop-all');
    const togglePanelBtn = document.getElementById('toggle-panel');
    const customUrlsTextarea = document.getElementById('custom-urls');
    const statusText = document.getElementById('status-text');
    const statusDiv = document.querySelector('.status');

    // WebSocket Elemente
    const wsReconnectBtn = document.getElementById('ws-reconnect');
    const wsTestBtn = document.getElementById('ws-test');
    const wsServerUrlInput = document.getElementById('ws-server-url');
    const wsStatusText = document.getElementById('ws-status-text');
    const wsUrlText = document.getElementById('ws-url-text');
    const wsNotificationCount = document.getElementById('ws-notification-count');

    // Einstellungen laden
    loadSettings();

    // WebSocket Status laden
    updateWebSocketStatus();

    // Event Listeners
    quickMonitorBtn.addEventListener('click', startQuickMonitoring);
    monitorCustomBtn.addEventListener('click', startCustomMonitoring);
    stopAllBtn.addEventListener('click', stopAllMonitoring);
    togglePanelBtn.addEventListener('click', toggleStatusPanel);

    // WebSocket Event Listeners
    wsReconnectBtn.addEventListener('click', reconnectWebSocket);
    wsTestBtn.addEventListener('click', testNotification);
    wsServerUrlInput.addEventListener('change', updateWebSocketUrl);

    // Einstellungen bei Änderung speichern
    document.getElementById('max-retries').addEventListener('change', saveSettings);
    document.getElementById('initial-delay').addEventListener('change', saveSettings);
    document.getElementById('max-delay').addEventListener('change', saveSettings);

    // WebSocket Status alle 2 Sekunden aktualisieren
    setInterval(updateWebSocketStatus, 2000);

    function loadSettings() {
        chrome.storage.sync.get({
            maxRetries: 100,
            initialDelay: 25,
            maxDelay: 10000,
            customUrls: '',
            wsServerUrl: 'ws://localhost:25566'
        }, function(items) {
            document.getElementById('max-retries').value = items.maxRetries;
            document.getElementById('initial-delay').value = items.initialDelay;
            document.getElementById('max-delay').value = items.maxDelay;
            customUrlsTextarea.value = items.customUrls;
            wsServerUrlInput.value = items.wsServerUrl;
        });
    }

    function saveSettings() {
        const settings = {
            maxRetries: parseInt(document.getElementById('max-retries').value),
            initialDelay: parseInt(document.getElementById('initial-delay').value),
            maxDelay: parseInt(document.getElementById('max-delay').value),
            customUrls: customUrlsTextarea.value,
            wsServerUrl: wsServerUrlInput.value
        };

        chrome.storage.sync.set(settings);
    }

    function updateWebSocketStatus() {
        chrome.runtime.sendMessage({ action: 'getWebSocketStatus' }, (response) => {
            if (response) {
                wsStatusText.textContent = response.connected ? 'Verbunden' : 'Getrennt';
                wsStatusText.style.color = response.connected ? '#4CAF50' : '#f44336';
                wsUrlText.textContent = response.serverUrl;
                wsNotificationCount.textContent = response.notificationCount;

                // Zeige Reconnect-Versuche wenn getrennt
                if (!response.connected && response.reconnectAttempts > 0) {
                    const reconnectInfo = document.getElementById('ws-reconnect-info');
                    if (reconnectInfo) {
                        reconnectInfo.textContent = `${response.reconnectAttempts}/${response.maxReconnectAttempts}`;
                        reconnectInfo.style.display = 'inline';
                    }
                } else {
                    const reconnectInfo = document.getElementById('ws-reconnect-info');
                    if (reconnectInfo) {
                        reconnectInfo.style.display = 'none';
                    }
                }
            }
        });
    }

    function reconnectWebSocket() {
        const newUrl = wsServerUrlInput.value.trim();
        if (newUrl && newUrl !== wsUrlText.textContent) {
            chrome.runtime.sendMessage({
                action: 'updateServerUrl',
                url: newUrl
            }, (response) => {
                if (response && response.success) {
                    updateStatus('WebSocket verbindet mit neuem Server...', 'info');
                    saveSettings();
                }
            });
        } else {
            chrome.runtime.sendMessage({ action: 'reconnectWebSocket' }, (response) => {
                if (response && response.success) {
                    updateStatus('WebSocket wird neu verbunden...', 'info');
                }
            });
        }
    }

    function updateWebSocketUrl() {
        saveSettings();
    }

    function testNotification() {
        chrome.runtime.sendMessage({ action: 'sendTestMessage' }, (response) => {
            if (response && response.success) {
                updateStatus('Test-Nachricht an Server gesendet', 'success');
            } else {
                updateStatus('Fehler beim Senden der Test-Nachricht', 'error');
            }
        });
    }

    function updateStatus(message, type = 'normal') {
        statusText.textContent = message;
        statusDiv.className = 'status';

        if (type === 'active') {
            statusDiv.classList.add('active');
        } else if (type === 'error') {
            statusDiv.classList.add('error');
        }
    }

    function executeInCurrentTab(code) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.executeScript(tabs[0].id, {
                code: code
            }, function(result) {
                if (chrome.runtime.lastError) {
                    updateStatus('Fehler beim Ausführen des Scripts', 'error');
                    console.error(chrome.runtime.lastError);
                }
            });
        });
    }

    function startQuickMonitoring() {
        updateStatus('Standard Port-Monitoring gestartet...', 'active');

        const settings = {
            maxRetries: parseInt(document.getElementById('max-retries').value),
            initialDelay: parseInt(document.getElementById('initial-delay').value),
            maxDelay: parseInt(document.getElementById('max-delay').value)
        };

        const code = `
            if (window.portMonitor) {
                window.portMonitor.maxRetries = ${settings.maxRetries};
                window.portMonitor.initialDelayMs = ${settings.initialDelay};
                window.portMonitor.maxDelayMs = ${settings.maxDelay};
                window.portMonitor.default();
            } else {
                console.warn('Port Monitor nicht verfügbar');
            }
        `;

        executeInCurrentTab(code);

        setTimeout(() => {
            updateStatus('Monitoring läuft...', 'active');
        }, 1000);
    }

    function startCustomMonitoring() {
        const customUrls = customUrlsTextarea.value.trim();

        if (!customUrls) {
            updateStatus('Bitte URLs eingeben', 'error');
            return;
        }

        saveSettings();
        updateStatus('Benutzerdefiniertes Monitoring gestartet...', 'active');

        const urls = customUrls.split('\n')
            .map(url => url.trim())
            .filter(url => url.length > 0);

        const settings = {
            maxRetries: parseInt(document.getElementById('max-retries').value),
            initialDelay: parseInt(document.getElementById('initial-delay').value),
            maxDelay: parseInt(document.getElementById('max-delay').value)
        };

        const code = `
            if (window.portMonitor) {
                window.portMonitor.maxRetries = ${settings.maxRetries};
                window.portMonitor.initialDelayMs = ${settings.initialDelay};
                window.portMonitor.maxDelayMs = ${settings.maxDelay};
                window.portMonitor.monitorPorts(${JSON.stringify(urls)});
            } else {
                console.warn('Port Monitor nicht verfügbar');
            }
        `;

        executeInCurrentTab(code);

        setTimeout(() => {
            updateStatus(`Monitoring ${urls.length} URLs...`, 'active');
        }, 1000);
    }

    function stopAllMonitoring() {
        updateStatus('Stoppe alle Überwachungen...', 'normal');

        const code = `
            if (window.portMonitor) {
                window.portMonitor.stopAllMonitoring();
                
                // Status-Panel verstecken
                const statusPanel = document.getElementById('port-monitor-status');
                if (statusPanel) {
                    statusPanel.style.display = 'none';
                    statusPanel.innerHTML = '';
                }
                
                // Button entfernen falls vorhanden
                const button = document.getElementById('port-monitor-button');
                if (button && button.parentNode) {
                    button.remove();
                }
            }
        `;

        executeInCurrentTab(code);

        setTimeout(() => {
            updateStatus('Alle Überwachungen gestoppt', 'normal');
        }, 500);
    }

    function toggleStatusPanel() {
        const code = `
            const statusPanel = document.getElementById('port-monitor-status');
            if (statusPanel) {
                if (statusPanel.style.display === 'none') {
                    statusPanel.style.display = 'block';
                } else {
                    statusPanel.style.display = 'none';
                }
            }
        `;

        executeInCurrentTab(code);
        updateStatus('Status-Panel umgeschaltet', 'normal');
    }

    // Tastenkürzel
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    startQuickMonitoring();
                    break;
                case '2':
                    e.preventDefault();
                    startCustomMonitoring();
                    break;
                case 's':
                    e.preventDefault();
                    stopAllMonitoring();
                    break;
                case 't':
                    e.preventDefault();
                    toggleStatusPanel();
                    break;
            }
        }
    });

    // Initial status
    updateStatus('Bereit - Wählen Sie eine Monitoring-Option');
});
