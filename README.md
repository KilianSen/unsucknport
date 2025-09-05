# Port Monitor Pro - Firefox Extension

Eine mehrzweckfähige Firefox-Erweiterung für Port-Monitoring und Gesundheitschecks von Webservices.

## Features

### 🚀 Hauptfunktionen
- **Automatisches Port-Monitoring** mit konfigurierbaren Retry-Mechanismen
- **Echtzeit-Status-Anzeige** direkt auf der Webseite
- **Benutzerdefinierte URL-Überwachung** für beliebige Services
- **Intelligente Fallback-Mechanismen** (fetch + image requests)
- **Exponential Backoff** mit Jitter für optimale Performance
- **Einstellbares Timeout und Retry-Verhalten**

### 🎯 Anwendungsfälle
- Development-Server-Monitoring während der Entwicklung
- Gesundheitschecks für Microservices
- Port-Verfügbarkeitsprüfung nach Deployments
- Überwachung lokaler Services (Prometheus, APIs, etc.)

## Installation

1. Laden Sie die Erweiterung in Firefox:
   - Öffnen Sie `about:debugging`
   - Klicken Sie auf "Temporäres Add-on laden"
   - Wählen Sie die `manifest.json` Datei aus

2. Die Erweiterung ist nun in der Toolbar verfügbar

## Verwendung

### Schnellstart
1. Klicken Sie auf das Port Monitor Pro Icon in der Toolbar
2. Wählen Sie "Standard Ports überwachen" für die vorkonfigurierten Ports:
   - `:9100` (Prometheus Node Exporter)
   - `:10101` (Custom Service)
   - `:10100` (Custom Service)

### Benutzerdefinierte URLs
1. Geben Sie URLs im Textfeld ein (eine pro Zeile):
   ```
   http://localhost:3000
   https://api.example.com:8080
   http://192.168.1.100:9090
   ```
2. Klicken Sie "Benutzerdefinierte URLs überwachen"

### Einstellungen
- **Max. Wiederholungen**: Anzahl der Retry-Versuche (1-1000)
- **Anfangsverzögerung**: Erste Wartezeit in ms (100-30000)
- **Max. Verzögerung**: Maximale Wartezeit zwischen Versuchen (1000-60000)

### Steuerung
- **Alle Überwachungen stoppen**: Beendet alle aktiven Monitoring-Prozesse
- **Status-Panel ein/ausblenden**: Zeigt/versteckt das Overlay auf der Webseite

## Tastenkürzel

- `Ctrl/Cmd + 1`: Standard Port-Monitoring starten
- `Ctrl/Cmd + 2`: Benutzerdefiniertes Monitoring starten
- `Ctrl/Cmd + S`: Alle Überwachungen stoppen
- `Ctrl/Cmd + T`: Status-Panel umschalten

## Status-Anzeige

Das Status-Panel erscheint oben rechts auf der Webseite und zeigt:
- **CHECKING** (Blau): Verbindungsversuch läuft
- **SUCCESS** (Grün): Port antwortet erfolgreich
- **ERROR** (Rot): Verbindung fehlgeschlagen
- **FAILED** (Orange): Maximale Versuche erreicht

Erfolgreiche Verbindungen verschwinden automatisch nach 3 Sekunden.

## Technische Details

### Monitoring-Algorithmus
1. **HEAD Request**: Minimaler HTTP-Request für schnelle Checks
2. **Favicon Fallback**: Bei CORS-Problemen wird ein Image-Request versucht
3. **Exponential Backoff**: Intelligente Wartezeiten zwischen Versuchen
4. **Jitter**: Zufällige Komponente verhindert Thundering Herd

### Unterstützte Protokolle
- HTTP und HTTPS
- Beliebige Ports
- IPv4 und IPv6 (abhängig vom Browser)

## Entwicklung

### Dateistruktur
```
/
├── manifest.json          # Extension Manifest
├── icons/
│   └── default.png       # Extension Icon
├── popup/
│   ├── default.html      # Popup Interface
│   └── style.css         # Popup Styling
└── js/
    ├── scripts/
    │   └── default.js    # Content Script (Port Monitor)
    └── ui_scripts/
        └── default.js    # Popup Logic
```

### Content Script Features
- Läuft auf allen Webseiten
- Erstellt UI-Elemente dynamisch
- Globale `window.portMonitor` Instanz verfügbar
- Automatische Cleanup bei Seitenwechsel

### Popup Interface
- Chrome Storage API für persistente Einstellungen
- Kommunikation mit Content Script über `executeScript`
- Responsive Design für verschiedene Bildschirmgrößen

## Fehlerbehebung

### Häufige Probleme

**"Port Monitor nicht verfügbar"**
- Stellen Sie sicher, dass die Seite vollständig geladen ist
- Überprüfen Sie die Browserkonsole auf Fehler

**CORS-Fehler**
- Die Erweiterung verwendet `no-cors` Mode und Fallback-Mechanismen
- Bei persistenten Problemen lokale Entwicklungsserver mit CORS-Headers konfigurieren

**Performance-Probleme**
- Reduzieren Sie die maximale Anzahl der Wiederholungen
- Erhöhen Sie die Anfangsverzögerung
- Überwachen Sie nur notwendige Services

## Lizenz

Siehe LICENSE Datei für Details.

## Changelog

### v1.0.0
- Initiale Veröffentlichung
- Vollständiges Port-Monitoring-System
- Popup-Interface mit Einstellungen
- Status-Panel mit Echtzeit-Updates
- Tastenkürzel-Unterstützung
