const dgram = require('dgram');
const os = require('os');

/**
 * Creates a WS-Discovery probe message
 */
function createProbeMessage() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Envelope xmlns="http://www.w3.org/2003/05/soap-envelope" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
    <Header>
        <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:uuid:${generateUUID()}</wsa:MessageID>
        <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
        <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
    </Header>
    <Body>
        <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
            <Types>dn:NetworkVideoTransmitter</Types>
            <Scopes />
        </Probe>
    </Body>
</Envelope>`;
}

/**
 * Generate a simple UUID
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Parse ONVIF probe response
 */
function parseProbeResponse(xmlString) {
    try {
        // Extract XAddrs
        const xaddrsMatch = xmlString.match(/<wsdd:XAddrs>(.*?)<\/wsdd:XAddrs>/);
        const xaddr = xaddrsMatch ? xaddrsMatch[1].trim() : null;

        if (!xaddr) return null;

        // Parse URL to get IP and port
        const urlMatch = xaddr.match(/https?:\/\/([^:\/]+):?(\d+)?/);
        if (!urlMatch) return null;

        const address = urlMatch[1];
        const port = urlMatch[2] ? parseInt(urlMatch[2]) : 80;

        // Extract name/model from Scopes
        const scopesMatch = xmlString.match(/<wsdd:Scopes>(.*?)<\/wsdd:Scopes>/);
        let name = 'Unknown Camera';
        let manufacturer = 'Unknown';

        if (scopesMatch) {
            const scopes = scopesMatch[1];
            const nameMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/name\/([^\s]+)/);
            const hwMatch = scopes.match(/onvif:\/\/www\.onvif\.org\/hardware\/([^\s]+)/);

            if (nameMatch) name = decodeURIComponent(nameMatch[1]);
            if (hwMatch) manufacturer = decodeURIComponent(hwMatch[1]);
        }

        return {
            address,
            port,
            name,
            manufacturer,
            xaddr,
            hostname: address
        };
    } catch (err) {
        console.error('[Discovery] Error parsing response:', err);
        return null;
    }
}

/**
 * Probe a single IP address
 */
async function probeIP(ip, port = 3702, timeout = 2000) {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        const probeMessage = createProbeMessage();
        const buffer = Buffer.from(probeMessage);
        let resolved = false;

        socket.on('message', (msg, rinfo) => {
            if (!resolved) {
                resolved = true;
                const device = parseProbeResponse(msg.toString());
                socket.close();
                resolve(device);
            }
        });

        socket.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                socket.close();
                resolve(null);
            }
        });

        socket.bind(() => {
            socket.send(buffer, 0, buffer.length, port, ip, (err) => {
                if (err && !resolved) {
                    resolved = true;
                    socket.close();
                    resolve(null);
                }
            });

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    socket.close();
                    resolve(null);
                }
            }, timeout);
        });
    });
}

/**
 * Get local subnet IP range
 */
function getLocalSubnet() {
    const interfaces = os.networkInterfaces();

    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            // Skip internal and IPv6 addresses
            if (iface.internal || iface.family !== 'IPv4') continue;

            // Skip docker interfaces
            if (name.startsWith('docker')) continue;

            // Get network address
            const ip = iface.address;
            const parts = ip.split('.');

            if (parts[0] === '192' && parts[1] === '168') {
                return {
                    base: `${parts[0]}.${parts[1]}.${parts[2]}`,
                    start: 1,
                    end: 254
                };
            }
        }
    }

    // Default to 192.168.0.x
    return { base: '192.168.0', start: 1, end: 254 };
}

/**
 * Scan subnet for ONVIF cameras
 * @param {Object} options - Scan options
 * @param {string} options.subnet - Subnet base (e.g., '192.168.0')
 * @param {number} options.start - Start IP (e.g., 1)
 * @param {number} options.end - End IP (e.g., 254)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Array>} Array of discovered devices
 */
async function scanSubnet(options = {}) {
    const subnet = options.subnet || getLocalSubnet();
    const base = typeof subnet === 'string' ? subnet : subnet.base;
    const start = options.start || subnet.start || 1;
    const end = options.end || subnet.end || 254;
    const onProgress = options.onProgress || (() => {});

    console.log(`[Discovery] Starting subnet scan: ${base}.${start}-${end}`);

    const devices = [];
    const total = end - start + 1;
    let scanned = 0;

    // Scan in batches to avoid overwhelming the network
    const batchSize = 10;

    for (let i = start; i <= end; i += batchSize) {
        const batch = [];

        for (let j = 0; j < batchSize && (i + j) <= end; j++) {
            const ip = `${base}.${i + j}`;
            batch.push(
                probeIP(ip).then((device) => {
                    scanned++;
                    onProgress({
                        scanned,
                        total,
                        percentage: Math.round((scanned / total) * 100),
                        currentIP: ip,
                        found: devices.length
                    });

                    if (device) {
                        console.log(`[Discovery] Found device at ${device.address}:${device.port}`);
                        devices.push(device);
                    }

                    return device;
                })
            );
        }

        // Wait for batch to complete
        await Promise.all(batch);
    }

    console.log(`[Discovery] Subnet scan complete. Found ${devices.length} device(s).`);
    return devices;
}

module.exports = {
    scanSubnet,
    probeIP,
    getLocalSubnet
};
