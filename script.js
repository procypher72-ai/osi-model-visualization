/**
 * =============================================================================
 * OSI MODEL VISUALIZER — script.js  (v2 — Real Message Journey Edition)
 * =============================================================================
 * NEW in v2:
 *   - MessageJourney Engine: computes exact per-layer transformation of the
 *     user's typed message (HTTP headers, AES simulation, TCP segment fields,
 *     IP packet fields, Ethernet frame, binary bits)
 *   - Live Send mode: user types a message and "sends" it — watches it travel
 *     through all 7 sender layers, then all 7 receiver layers automatically
 *   - Full Journey Overlay: side-by-side SENDER ↔ RECEIVER view for every
 *     layer showing the actual message content at each stage
 *   - Real packet blocks now show actual message-derived content
 *   - "Message at this Layer" code-block in the detail card
 *
 * State Management:
 *   - `state` object is the single source of truth
 *   - `journey` is recomputed whenever the message changes
 *   - `render()` reads both and rebuilds the DOM
 * =============================================================================
 */

'use strict';

/* =============================================================================
   DATA — OSI Layer Definitions
   ============================================================================= */
const OSI_LAYERS = [
  {
    num: 7, name: 'Application', shortName: 'APP', pdu: 'Data / Message',
    color: '#38bdf8', icon: '🌐',
    protocols: ['HTTP', 'HTTPS', 'FTP', 'DNS', 'SMTP', 'SSH'],
    what: [
      'Provides network services directly to user applications (browser, email client).',
      'Handles high-level APIs, resource sharing, and remote file access.',
      'Wraps your raw message into a protocol envelope (e.g. HTTP GET request).'
    ],
    analogy: '📝 Writing a letter — you compose the content and choose how to say it. The browser wraps your message as an HTTP request before anything else happens.',
    devices: ['💻 End-User PC', '🖥️ App Server', '🌍 Web Browser', '📧 Email Client'],
    facts: { 'PDU': 'Data / Message', 'Standard': 'OSI / TCP/IP', 'Port Range': '1–1023 (Well-Known)', 'Example': 'HTTP:80, HTTPS:443' }
  },
  {
    num: 6, name: 'Presentation', shortName: 'PRES', pdu: 'Data',
    color: '#a78bfa', icon: '🎨',
    protocols: ['SSL/TLS', 'ASCII', 'JPEG', 'MPEG', 'GIF', 'AES'],
    what: [
      'Translates data format: encodes characters to UTF-8/ASCII bytes.',
      'Compresses the data with gzip/deflate to reduce bandwidth usage.',
      'Encrypts the data using TLS (AES-256) so nobody can read it in transit.'
    ],
    analogy: '🔐 Like a translator + paper-shredder combo — it translates your letter into a secret code only the recipient can read, then compresses it to save space.',
    devices: ['🔒 SSL/TLS Proxy', '🗜️ Compression Engine', '📡 Gateway', '💻 OS Layer'],
    facts: { 'PDU': 'Data', 'Encryption': 'TLS 1.3, AES-256-GCM', 'Compression': 'gzip / Deflate', 'Encoding': 'UTF-8, Base64' }
  },
  {
    num: 5, name: 'Session', shortName: 'SESS', pdu: 'Data',
    color: '#34d399', icon: '🔗',
    protocols: ['NetBIOS', 'PPTP', 'RPC', 'SCP', 'SQL', 'NFS'],
    what: [
      'Establishes, manages, and terminates the communication session.',
      'Assigns a unique Session ID so the server recognises your conversation.',
      'Handles checkpointing — if transfer fails, it can resume from the last checkpoint.'
    ],
    analogy: '📞 Like dialling a phone call — this layer "picks up the phone", keeps the call alive while your message travels, and properly hangs up when done.',
    devices: ['🖧 App Server', '🔧 Session Manager', '🌐 API Gateway', '📡 RPC Server'],
    facts: { 'PDU': 'Data', 'Modes': 'Half-duplex / Full-duplex', 'Key Feature': 'Checkpointing', 'Example': 'SQL Session, NetBIOS' }
  },
  {
    num: 4, name: 'Transport', shortName: 'TRANS', pdu: 'Segment',
    color: '#f59e0b', icon: '📦',
    protocols: ['TCP', 'UDP', 'SCTP', 'DCCP', 'SPX'],
    what: [
      'Segments the data into smaller chunks and numbers them (Seq. #) for ordered reassembly.',
      'Adds source + destination port numbers (your app is identified by port).',
      'TCP guarantees delivery via ACK acknowledgements and retransmission if lost.'
    ],
    analogy: '📮 Like a courier splitting a big parcel into numbered boxes. If box #3 is lost, TCP asks for it again. UDP just throws them all on a truck without tracking.',
    devices: ['🔥 Firewall', '🔄 Load Balancer', '🖥️ OS (TCP/IP Stack)', '📡 Socket API'],
    facts: { 'PDU': 'Segment (TCP) / Datagram (UDP)', 'Port Range': '0–65535', 'TCP': 'Reliable, ordered, slow', 'UDP': 'Fast, connectionless' }
  },
  {
    num: 3, name: 'Network', shortName: 'NET', pdu: 'Packet',
    color: '#f87171', icon: '🗺️',
    protocols: ['IPv4', 'IPv6', 'ICMP', 'ARP', 'OSPF', 'BGP'],
    what: [
      'Adds logical IP addresses (source & destination) creating a Packet.',
      'Determines the best routing path across multiple networks (routers).',
      'TTL field limits how many hops the packet can make before being discarded.'
    ],
    analogy: '🗺️ Writing the full postal address on the envelope. Routers are like sorting offices that read the address and route the letter toward its destination city.',
    devices: ['🔀 Router', '🌐 Layer-3 Switch', '🛡️ Firewall (L3)', '📡 Wireless AP'],
    facts: { 'PDU': 'Packet', 'IPv4 Header': '20–60 bytes', 'IPv6 Header': '40 bytes (fixed)', 'TTL Default': '64 or 128 hops' }
  },
  {
    num: 2, name: 'Data Link', shortName: 'DL', pdu: 'Frame',
    color: '#fb923c', icon: '🔌',
    protocols: ['Ethernet', 'Wi-Fi 802.11', 'PPP', 'HDLC', 'ARP', 'VLAN'],
    what: [
      'Wraps the IP Packet in an Ethernet Frame with MAC addresses (hardware addresses).',
      'MAC addresses are local — only relevant for the next hop (not the final destination).',
      'Appends an FCS (Frame Check Sequence / CRC-32) trailer for error detection.'
    ],
    analogy: '🏠 Like writing the street address for the next delivery point. The truck driver only needs to know the next building — not the final city. At each hop, MAC addresses are replaced.',
    devices: ['🔀 Network Switch', '🌉 Bridge', '📶 Wi-Fi AP', '🖧 NIC (Network Card)'],
    facts: { 'PDU': 'Frame', 'Addressing': 'MAC (48-bit = 6 bytes)', 'Error Check': 'CRC-32 (FCS)', 'Sub-layers': 'LLC + MAC' }
  },
  {
    num: 1, name: 'Physical', shortName: 'PHY', pdu: 'Bits',
    color: '#94a3b8', icon: '⚡',
    protocols: ['Ethernet 802.3', 'USB', 'DSL', 'Bluetooth', 'RS-232', 'Fiber'],
    what: [
      'Converts every bit of the frame into a physical signal (electricity, light, or radio).',
      'Defines cable type, pin layout, voltage levels, frequencies, and bit timing.',
      'Your message "Hello World" leaves as 88 bits of electrical pulses on a wire.'
    ],
    analogy: '⚡ The actual road, highway, and trucks. This layer doesn\'t care what\'s in the package — it just moves raw electrons or photons from one end to the other.',
    devices: ['📡 Cat6/Fiber Cable', '🔌 Network Hub', '📶 Radio Transmitter', '⚡ NIC (PHY chip)', '🔆 Repeater'],
    facts: { 'PDU': 'Bits (0s and 1s)', 'Signal': 'Electrical / Optical / Radio', 'Max Speed': '100 Gbps (Ethernet)', 'Cable': 'Cat5e, Cat6, Fiber, Coax' }
  }
];

/* =============================================================================
   SVG DIAGRAMS — per layer
   ============================================================================= */
function getSvgForLayer(num) {
  const svgs = {
    7: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#38bdf808"/>
      <rect x="30" y="25" width="180" height="130" rx="10" fill="#141928" stroke="#38bdf8" stroke-width="1.5"/>
      <rect x="30" y="25" width="180" height="30" rx="10" fill="#1e2a3a"/>
      <rect x="30" y="41" width="180" height="14" fill="#1e2a3a"/>
      <circle cx="48" cy="40" r="5" fill="#f87171"/><circle cx="62" cy="40" r="5" fill="#f59e0b"/><circle cx="76" cy="40" r="5" fill="#34d399"/>
      <rect x="95" y="33" width="100" height="14" rx="5" fill="#0f1420" stroke="#38bdf830" stroke-width="1"/>
      <text x="100" y="44" font-size="7" fill="#38bdf8" font-family="monospace">https://example.com</text>
      <rect x="45" y="65" width="150" height="7" rx="2" fill="#38bdf830"/>
      <rect x="45" y="78" width="115" height="5" rx="2" fill="#ffffff18"/>
      <rect x="45" y="89" width="130" height="5" rx="2" fill="#ffffff12"/>
      <rect x="45" y="100" width="95" height="5" rx="2" fill="#ffffff10"/>
      <rect x="45" y="115" width="70" height="22" rx="5" fill="#38bdf8cc"/>
      <text x="80" y="130" font-size="9" fill="#000" font-weight="bold" font-family="sans-serif" text-anchor="middle">Send →</text>
      <text x="120" y="180" font-size="10" fill="#38bdf8" font-weight="bold" font-family="monospace" text-anchor="middle">HTTP / HTTPS</text>
    </svg>`,

    6: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#a78bfa08"/>
      <rect x="85" y="45" width="70" height="60" rx="10" fill="#141928" stroke="#a78bfa" stroke-width="1.5"/>
      <path d="M100 45 Q120 18 140 45" fill="none" stroke="#a78bfa" stroke-width="3" stroke-linecap="round"/>
      <circle cx="120" cy="68" r="8" fill="#a78bfa"/>
      <rect x="117" y="68" width="6" height="14" rx="3" fill="#a78bfa"/>
      <text x="40" y="75" font-size="10" fill="#e2e8f040" font-family="monospace">Hello</text>
      <text x="40" y="90" font-size="10" fill="#a78bfa40" font-family="monospace">→ AES →</text>
      <text x="165" y="75" font-size="9" fill="#a78bfa" font-family="monospace">x9fK2m</text>
      <text x="165" y="90" font-size="9" fill="#a78bfa80" font-family="monospace">Qr3bZ8..</text>
      <rect x="25" y="115" width="90" height="30" rx="5" fill="#141928" stroke="#a78bfa30" stroke-width="1"/>
      <text x="70" y="128" text-anchor="middle" font-size="7" fill="#a78bfa" font-family="monospace">PLAIN → CIPHER</text>
      <text x="70" y="140" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="monospace">AES-256-GCM</text>
      <rect x="125" y="115" width="90" height="30" rx="5" fill="#141928" stroke="#34d39930" stroke-width="1"/>
      <text x="170" y="128" text-anchor="middle" font-size="7" fill="#34d399" font-family="monospace">gzip compress</text>
      <text x="170" y="140" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="monospace">~35-60% smaller</text>
      <text x="120" y="180" font-size="10" fill="#a78bfa" font-weight="bold" font-family="monospace" text-anchor="middle">TLS 1.3 / AES-256</text>
    </svg>`,

    5: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#34d39908"/>
      <rect x="15" y="60" width="64" height="44" rx="6" fill="#141928" stroke="#34d399" stroke-width="1.2"/>
      <text x="47" y="86" text-anchor="middle" font-size="9" fill="#34d399" font-family="monospace">Client</text>
      <rect x="161" y="60" width="64" height="44" rx="6" fill="#141928" stroke="#34d399" stroke-width="1.2"/>
      <text x="193" y="86" text-anchor="middle" font-size="9" fill="#34d399" font-family="monospace">Server</text>
      <line x1="79" y1="74" x2="161" y2="74" stroke="#34d39970" stroke-width="1.5" stroke-dasharray="5,3"/>
      <line x1="79" y1="83" x2="161" y2="83" stroke="#34d39940" stroke-width="1" stroke-dasharray="5,3"/>
      <line x1="79" y1="92" x2="161" y2="92" stroke="#34d39920" stroke-width="1" stroke-dasharray="5,3"/>
      <polygon points="156,71 164,74 156,77" fill="#34d399"/>
      <polygon points="84,80 76,83 84,86" fill="#34d39980"/>
      <polygon points="156,89 164,92 156,95" fill="#34d39960"/>
      <text x="120" y="70" text-anchor="middle" font-size="6.5" fill="#34d399" font-family="monospace">SYN →</text>
      <text x="120" y="81" text-anchor="middle" font-size="6.5" fill="#34d39980" font-family="monospace">← SYN-ACK</text>
      <text x="120" y="92" text-anchor="middle" font-size="6.5" fill="#34d39960" font-family="monospace">ACK →</text>
      <rect x="70" y="118" width="100" height="24" rx="5" fill="#34d39912" stroke="#34d39940" stroke-width="1"/>
      <text x="120" y="134" text-anchor="middle" font-size="9" fill="#34d399" font-family="monospace" font-weight="bold">SESSION ACTIVE ✓</text>
      <text x="120" y="180" font-size="10" fill="#34d399" font-weight="bold" font-family="monospace" text-anchor="middle">Session Established</text>
    </svg>`,

    4: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#f59e0b08"/>
      <rect x="15" y="30" width="90" height="46" rx="6" fill="#f59e0b18" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="60" y="50" text-anchor="middle" font-size="8" fill="#f59e0b" font-family="monospace">Full Data</text>
      <text x="60" y="65" text-anchor="middle" font-size="7" fill="#f59e0b80" font-family="monospace">1 chunk</text>
      <path d="M110 53 L130 53" stroke="#f59e0b80" stroke-width="2" marker-end="url(#arr4)"/>
      <defs><marker id="arr4" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7Z" fill="#f59e0b80"/></marker></defs>
      <text x="120" y="48" text-anchor="middle" font-size="6.5" fill="#f59e0b60" font-family="monospace">split</text>
      <rect x="134" y="22" width="50" height="26" rx="3" fill="#f59e0b20" stroke="#f59e0b" stroke-width="1"/>
      <text x="159" y="35" text-anchor="middle" font-size="6.5" fill="#f59e0b" font-family="monospace">SEQ:1</text>
      <text x="159" y="44" text-anchor="middle" font-size="6" fill="#f59e0b70" font-family="monospace">PORT:80</text>
      <rect x="134" y="52" width="50" height="26" rx="3" fill="#f59e0b15" stroke="#f59e0b80" stroke-width="1"/>
      <text x="159" y="65" text-anchor="middle" font-size="6.5" fill="#f59e0b" font-family="monospace">SEQ:2</text>
      <text x="159" y="74" text-anchor="middle" font-size="6" fill="#f59e0b70" font-family="monospace">PORT:80</text>
      <rect x="15" y="108" width="100" height="40" rx="5" fill="#141928" stroke="#f59e0b40" stroke-width="1"/>
      <text x="65" y="121" text-anchor="middle" font-size="8" fill="#f59e0b" font-family="monospace" font-weight="bold">TCP</text>
      <text x="65" y="133" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="sans-serif">Reliable · Ordered</text>
      <text x="65" y="143" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="sans-serif">ACK + Retransmit</text>
      <rect x="125" y="108" width="100" height="40" rx="5" fill="#141928" stroke="#38bdf840" stroke-width="1"/>
      <text x="175" y="121" text-anchor="middle" font-size="8" fill="#38bdf8" font-family="monospace" font-weight="bold">UDP</text>
      <text x="175" y="133" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="sans-serif">Fast · No ACK</text>
      <text x="175" y="143" text-anchor="middle" font-size="6.5" fill="#64748b" font-family="sans-serif">Video / Gaming</text>
      <text x="120" y="180" font-size="10" fill="#f59e0b" font-weight="bold" font-family="monospace" text-anchor="middle">TCP Segmentation</text>
    </svg>`,

    3: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#f8717108"/>
      <circle cx="120" cy="95" r="26" fill="#141928" stroke="#f87171" stroke-width="2"/>
      <text x="120" y="91" text-anchor="middle" font-size="12" fill="#f87171">🔀</text>
      <text x="120" y="106" text-anchor="middle" font-size="7" fill="#f87171" font-family="monospace">Router</text>
      <circle cx="40" cy="48" r="18" fill="#141928" stroke="#f8717160" stroke-width="1.2"/>
      <text x="40" y="53" text-anchor="middle" font-size="11">💻</text>
      <text x="40" y="72" text-anchor="middle" font-size="5.5" fill="#f87171" font-family="monospace">192.168.1.x</text>
      <circle cx="200" cy="48" r="18" fill="#141928" stroke="#f8717160" stroke-width="1.2"/>
      <text x="200" y="53" text-anchor="middle" font-size="11">🖥️</text>
      <text x="200" y="72" text-anchor="middle" font-size="5.5" fill="#f87171" font-family="monospace">93.184.x.x</text>
      <circle cx="40" cy="155" r="18" fill="#141928" stroke="#f8717640" stroke-width="1.2"/>
      <text x="40" y="160" text-anchor="middle" font-size="11">📡</text>
      <circle cx="200" cy="155" r="18" fill="#141928" stroke="#f8717640" stroke-width="1.2"/>
      <text x="200" y="160" text-anchor="middle" font-size="11">🌐</text>
      <line x1="57" y1="57" x2="96" y2="80" stroke="#f87171" stroke-width="2.5"/>
      <line x1="143" y1="80" x2="182" y2="57" stroke="#f87171" stroke-width="2.5"/>
      <line x1="57" y1="145" x2="96" y2="110" stroke="#f8717130" stroke-width="1.2" stroke-dasharray="4,2"/>
      <line x1="143" y1="110" x2="182" y2="145" stroke="#f8717130" stroke-width="1.2" stroke-dasharray="4,2"/>
      <text x="120" y="180" font-size="10" fill="#f87171" font-weight="bold" font-family="monospace" text-anchor="middle">IP Routing</text>
    </svg>`,

    2: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#fb923c08"/>
      <rect x="80" y="78" width="80" height="38" rx="6" fill="#141928" stroke="#fb923c" stroke-width="1.8"/>
      <text x="120" y="97" text-anchor="middle" font-size="9" fill="#fb923c">🔀 Switch</text>
      <text x="120" y="109" text-anchor="middle" font-size="6" fill="#fb923c80" font-family="monospace">MAC Table</text>
      <rect x="8" y="33" width="224" height="32" rx="4" fill="#141928" stroke="#fb923c40" stroke-width="1"/>
      <rect x="8" y="33" width="56" height="32" fill="#fb923c18"/>
      <text x="36" y="46" text-anchor="middle" font-size="6.5" fill="#fb923c" font-family="monospace" font-weight="bold">DST MAC</text>
      <text x="36" y="58" text-anchor="middle" font-size="5.5" fill="#fb923c" font-family="monospace">AA:BB:CC:DD</text>
      <rect x="64" y="33" width="56" height="32" fill="#fb923c10"/>
      <text x="92" y="46" text-anchor="middle" font-size="6.5" fill="#fb923c80" font-family="monospace">SRC MAC</text>
      <text x="92" y="58" text-anchor="middle" font-size="5.5" fill="#fb923c80" font-family="monospace">11:22:33:44</text>
      <rect x="120" y="33" width="72" height="32" fill="transparent"/>
      <text x="156" y="50" text-anchor="middle" font-size="7" fill="#64748b" font-family="monospace">IP Packet</text>
      <rect x="192" y="33" width="40" height="32" fill="#f8717118"/>
      <text x="212" y="46" text-anchor="middle" font-size="6.5" fill="#f87171" font-family="monospace">FCS</text>
      <text x="212" y="58" text-anchor="middle" font-size="5.5" fill="#f87171" font-family="monospace">CRC-32</text>
      <line x1="36" y1="65" x2="90" y2="78" stroke="#fb923c50" stroke-width="1.2" stroke-dasharray="3,2"/>
      <text x="35" y="145" text-anchor="middle" font-size="22">🖥️</text>
      <text x="35" y="162" font-size="5.5" fill="#fb923c" text-anchor="middle" font-family="monospace">AA:BB:CC:DD</text>
      <text x="205" y="145" text-anchor="middle" font-size="22">💻</text>
      <text x="205" y="162" font-size="5.5" fill="#fb923c" text-anchor="middle" font-family="monospace">11:22:33:44</text>
      <line x1="54" y1="133" x2="82" y2="112" stroke="#fb923c40" stroke-width="1.2"/>
      <line x1="158" y1="112" x2="186" y2="133" stroke="#fb923c40" stroke-width="1.2"/>
      <text x="120" y="180" font-size="10" fill="#fb923c" font-weight="bold" font-family="monospace" text-anchor="middle">MAC Framing + CRC</text>
    </svg>`,

    1: `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" width="240" height="200">
      <rect width="240" height="200" fill="#94a3b808"/>
      <path d="M5 90 Q25 52 45 90 Q65 128 85 90 Q105 52 125 90 Q145 128 165 90 Q185 52 205 90 Q225 128 240 90"
            fill="none" stroke="#94a3b8" stroke-width="2.5" opacity="0.9"/>
      <path d="M5 110 Q15 96 25 110 Q35 124 45 110 Q55 96 65 110 Q75 124 85 110 Q95 96 105 110"
            fill="none" stroke="#94a3b850" stroke-width="1.5"/>
      <rect x="15" y="128" width="210" height="14" rx="7" fill="#1e2a3a" stroke="#94a3b840" stroke-width="1"/>
      <rect x="15" y="131" width="210" height="8" rx="4" fill="#94a3b850"/>
      <text x="120" y="158" text-anchor="middle" font-size="7" fill="#94a3b8" font-family="monospace" letter-spacing="1.5">01001000 01100101 01101100</text>
      <text x="120" y="170" text-anchor="middle" font-size="7" fill="#94a3b850" font-family="monospace" letter-spacing="1.5">01101100 01101111 00100001</text>
      <text x="28" y="88" font-size="8" fill="#94a3b870" font-family="monospace">V+</text>
      <text x="28" y="114" font-size="8" fill="#94a3b850" font-family="monospace">V-</text>
      <text x="120" y="28" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="monospace" font-weight="bold">⚡ Electrical Signal</text>
      <text x="120" y="185" font-size="10" fill="#94a3b8" font-weight="bold" font-family="monospace" text-anchor="middle">Bits on the Wire</text>
    </svg>`
  };
  return svgs[num] || '';
}

/* =============================================================================
   MESSAGE JOURNEY ENGINE
   Computes all per-layer transformations for a real user message
   ============================================================================= */

/** Random integer between min and max (inclusive) */
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
/** Random hex string of given length */
function randHex(len) {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
/** Generate a random MAC address */
function genMAC() {
  return Array.from({ length: 6 }, () => rnd(0, 255).toString(16).padStart(2, '0').toUpperCase()).join(':');
}

/**
 * Computes the full OSI journey for a given raw message string.
 * Returns an object with pre-computed values for every layer on both
 * sender (encapsulation) and receiver (decapsulation) sides.
 *
 * @param {string} msg  The raw user message, e.g. "Hello World"
 * @returns {object}    Journey data used by all render functions
 */
function computeJourney(msg) {
  // Network identifiers (randomly generated, stable per message)
  const srcIP  = `192.168.${rnd(1,5)}.${rnd(10,200)}`;
  const dstIP  = `${rnd(20,200)}.${rnd(100,250)}.${rnd(1,200)}.${rnd(2,254)}`;
  const srcMAC = genMAC();
  const dstMAC = genMAC();
  const gwMAC  = genMAC();   // gateway router MAC (what switch sees at Layer 2)
  const srcPort = rnd(49152, 65534);
  const dstPort = 443;       // HTTPS
  const seqNum  = rnd(100000000, 3999999999);
  const sessId  = randHex(16).toUpperCase();
  const tlsIV   = randHex(12).toUpperCase();
  const tlsTag  = randHex(8).toUpperCase();
  const ipId    = '0x' + randHex(4).toUpperCase();
  const crc32   = '0x' + randHex(8).toUpperCase();
  const checksum = '0x' + randHex(4).toUpperCase();

  // Byte-level representations
  const msgBytes  = [...msg].map(c => c.charCodeAt(0));
  const byteLen   = msgBytes.length;
  const bitLen    = byteLen * 8;
  const binaryStr = msgBytes.map(b => b.toString(2).padStart(8, '0')).join(' ');
  const hexStr    = msgBytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
  const base64Str = btoa(unescape(encodeURIComponent(msg)));
  // Simulated XOR cipher (visually shows transformed bytes)
  const cipherHex = msgBytes.map(b => ((b ^ 0x5A) & 0xFF).toString(16).padStart(2, '0')).join(' ');
  const compressedSize = Math.max(4, Math.floor(byteLen * 0.62));

  return {
    raw: msg,
    byteLen, bitLen,
    binaryStr, hexStr, base64Str, cipherHex,
    compressedSize,
    srcIP, dstIP, srcMAC, dstMAC, gwMAC,
    srcPort, dstPort, seqNum, sessId,
    tlsIV, tlsTag, ipId, crc32, checksum,

    // === SENDER SIDE — what the layer adds / transforms ===
    sender: {
      7: {
        label: 'HTTP Request Generated',
        code: [
          `POST /send HTTP/1.1`,
          `Host: chat.example.com`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Length: ${byteLen}`,
          `Connection: keep-alive`,
          ``,
          `${msg}`,
        ].join('\n'),
        summary: `Your message "${msg}" is wrapped in an HTTP POST request (${byteLen} bytes payload).`
      },
      6: {
        label: 'Encoded + Encrypted',
        code: [
          `-- ENCODING --`,
          `Original : "${msg}"`,
          `UTF-8 hex: ${hexStr}`,
          `Base64   : ${base64Str}`,
          ``,
          `-- TLS 1.3 ENCRYPTION (AES-256-GCM) --`,
          `Key      : [derived via TLS handshake]`,
          `IV/Nonce : ${tlsIV}`,
          `Cipher   : ${cipherHex}`,
          `Auth Tag : ${tlsTag}`,
          ``,
          `-- COMPRESSION (gzip) --`,
          `Before   : ${byteLen} bytes`,
          `After    : ~${compressedSize} bytes (saved ${byteLen - compressedSize}B)`,
        ].join('\n'),
        summary: `"${msg}" → Base64 encoded → AES-256 encrypted → gzip compressed to ~${compressedSize}B.`
      },
      5: {
        label: 'Session Token Added',
        code: [
          `-- SESSION HEADER --`,
          `Session-ID : ${sessId}`,
          `Sync-Point : ${rnd(1, 9999)}`,
          `Duplex     : FULL (bidirectional)`,
          `Auth       : Bearer ${randHex(20).toUpperCase()}`,
          ``,
          `-- DATA (passed from L6) --`,
          `[Encrypted payload: ${compressedSize} bytes]`,
          `IV: ${tlsIV}  Tag: ${tlsTag}`,
        ].join('\n'),
        summary: `Session ID "${sessId}" is attached so the server knows which conversation this belongs to.`
      },
      4: {
        label: 'TCP Segment Created',
        code: [
          ` ┌─────────────────────────────────────┐`,
          ` │ TCP SEGMENT HEADER                  │`,
          ` ├───────────────┬─────────────────────┤`,
          ` │ Src Port      │ ${srcPort}               ${srcPort > 9999 ? '' : ' '}│`,
          ` │ Dst Port      │ ${dstPort} (HTTPS)            │`,
          ` │ Seq Number    │ ${seqNum}        │`,
          ` │ Ack Number    │ 0                   │`,
          ` │ Flags         │ PSH | ACK           │`,
          ` │ Window Size   │ 65535               │`,
          ` │ Checksum      │ ${checksum}              │`,
          ` ├───────────────┴─────────────────────┤`,
          ` │ PAYLOAD: [Encrypted "${msg.length > 10 ? msg.substring(0,10)+'...' : msg}"]  │`,
          ` └─────────────────────────────────────┘`,
        ].join('\n'),
        summary: `Segment: ${srcPort} → ${dstPort} | Seq:${seqNum} | PSH+ACK | Your message is the payload.`
      },
      3: {
        label: 'IP Packet Assembled',
        code: [
          ` ┌─────────────────────────────────────┐`,
          ` │ IPv4 PACKET HEADER (20 bytes)       │`,
          ` ├───────────────┬─────────────────────┤`,
          ` │ Version       │ IPv4                │`,
          ` │ Header Length │ 20 bytes            │`,
          ` │ Total Length  │ ${byteLen + 60} bytes              │`,
          ` │ ID            │ ${ipId}              │`,
          ` │ Flags         │ DF (Don't Fragment) │`,
          ` │ TTL           │ 64                  │`,
          ` │ Protocol      │ TCP (6)             │`,
          ` ├───────────────┼─────────────────────┤`,
          ` │ Source IP     │ ${srcIP}          │`,
          ` │ Destination   │ ${dstIP}          │`,
          ` ├───────────────┴─────────────────────┤`,
          ` │ DATA: [TCP Segment with your msg]   │`,
          ` └─────────────────────────────────────┘`,
        ].join('\n'),
        summary: `IP packet: ${srcIP} → ${dstIP} | TTL:64 | Protocol:TCP | Total ${byteLen + 60}B`
      },
      2: {
        label: 'Ethernet Frame Built',
        code: [
          ` ┌─────────────────────────────────────┐`,
          ` │ ETHERNET II FRAME                   │`,
          ` ├───────────────┬─────────────────────┤`,
          ` │ Dst MAC       │ ${dstMAC}     │`,
          ` │ Src MAC       │ ${srcMAC}     │`,
          ` │ EtherType     │ 0x0800 (IPv4)       │`,
          ` ├───────────────┴─────────────────────┤`,
          ` │ PAYLOAD: [IP Packet]                │`,
          ` │ (contains your "${msg.length > 8 ? msg.substring(0,8)+'...' : msg}" message)     │`,
          ` ├─────────────────────────────────────┤`,
          ` │ FCS (CRC-32)  │ ${crc32}    │`,
          ` └───────────────┴─────────────────────┘`,
          ``,
          ` NOTE: These MACs are for the next hop only.`,
          ` They change at each router on the path.`,
        ].join('\n'),
        summary: `Frame: ${srcMAC} → ${dstMAC} | FCS:${crc32} | Frame total: ${byteLen + 54}B`
      },
      1: {
        label: 'Converted to Electrical Bits',
        code: [
          `Your message: "${msg}"`,
          ``,
          `BINARY REPRESENTATION:`,
          binaryStr,
          ``,
          `HEX REPRESENTATION:`,
          hexStr,
          ``,
          `Total: ${byteLen} bytes = ${bitLen} bits`,
          `Transmitted as: electrical pulses on Cat6`,
          `Speed: 1,000,000,000 bits/sec (1 Gbps)`,
          `Time to transmit: ~${(bitLen / 1000000000 * 1e9).toFixed(2)} nanoseconds`,
        ].join('\n'),
        summary: `"${msg}" → ${bitLen} bits transmitted as electrical pulses at 1 Gbps.`
      }
    },

    // === RECEIVER SIDE — what the layer strips / reveals ===
    receiver: {
      1: {
        label: 'Bits Received from Wire',
        code: [
          `RECEIVED BIT STREAM FROM PHYSICAL MEDIUM:`,
          binaryStr,
          ``,
          `HEX: ${hexStr}`,
          ``,
          `Total bits received: ${bitLen}`,
          `Signal type: Electrical (Cat6 UTP)`,
          `Signal OK ✓ — passing bits to Data Link Layer`,
        ].join('\n'),
        summary: `${bitLen} raw bits received on the wire. Passed up to Data Link Layer for framing.`
      },
      2: {
        label: 'Ethernet Frame Parsed',
        code: [
          ` RECEIVED ETHERNET FRAME — PARSING...`,
          ` ┌─────────────────────────────────────┐`,
          ` │ Dst MAC  : ${dstMAC}     │  ✓ (matches our NIC)`,
          ` │ Src MAC  : ${srcMAC}     │  (sender's NIC)`,
          ` │ EtherType: 0x0800 → IPv4            │`,
          ` │ FCS Check: ${crc32}      │  ✓ CRC-32 valid!`,
          ` └─────────────────────────────────────┘`,
          ` ✅ Frame accepted — MAC matches our NIC`,
          ` ✅ FCS valid — no bit errors in transmission`,
          ` → Stripping L2 header + FCS trailer...`,
          ` → Extracting IP packet and passing to L3`,
        ].join('\n'),
        summary: `Frame received, MAC verified, CRC-32 OK. Ethernet header + FCS stripped. IP packet passed to L3.`
      },
      3: {
        label: 'IP Packet Examined',
        code: [
          ` IP PACKET RECEIVED — PARSING...`,
          ` ┌─────────────────────────────────────┐`,
          ` │ Source IP : ${srcIP}          │`,
          ` │ Dst IP    : ${dstIP}          │  ✓ (our IP!)`,
          ` │ TTL       : 60 (was 64, -4 hops)   │`,
          ` │ Protocol  : TCP (6)                 │`,
          ` │ Total Len : ${byteLen + 60} bytes              │`,
          ` └─────────────────────────────────────┘`,
          ` ✅ Destination IP matches — this packet is for us`,
          ` ✅ TTL > 0 — packet is still valid`,
          ` → Stripping IP header (20 bytes)...`,
          ` → Extracting TCP segment and passing to L4`,
        ].join('\n'),
        summary: `Destination IP matched. TTL valid. IP header stripped. TCP segment extracted and passed to L4.`
      },
      4: {
        label: 'TCP Segment Reassembled',
        code: [
          ` TCP SEGMENT RECEIVED — PARSING...`,
          ` ┌─────────────────────────────────────┐`,
          ` │ Src Port  : ${srcPort}               │  (client)`,
          ` │ Dst Port  : ${dstPort}                    │  ✓ our HTTPS listener`,
          ` │ Seq #     : ${seqNum}        │`,
          ` │ Flags     : PSH | ACK               │`,
          ` │ Checksum  : ${checksum}              │  ✓ valid`,
          ` └─────────────────────────────────────┘`,
          ` ✅ Port ${dstPort} → matches our HTTPS server`,
          ` ✅ Checksum valid — data intact`,
          ` ✅ Sending ACK back to ${srcIP}:${srcPort}`,
          ` → Stripping TCP header...`,
          ` → Extracting encrypted payload for L5`,
        ].join('\n'),
        summary: `TCP segment received on port ${dstPort}. Checksum OK. ACK sent back. Header stripped.`
      },
      5: {
        label: 'Session Validated',
        code: [
          ` SESSION HEADER RECEIVED — PARSING...`,
          ` ┌─────────────────────────────────────┐`,
          ` │ Session-ID: ${sessId}   │`,
          ` │ Status    : ACTIVE ✓                │`,
          ` │ Sync-Pt   : valid ✓                 │`,
          ` │ Bearer    : verified ✓              │`,
          ` └─────────────────────────────────────┘`,
          ` ✅ Session "${sessId}" recognised`,
          ` ✅ Authentication token valid`,
          ` → Stripping session header...`,
          ` → Passing encrypted data to L6 for decryption`,
        ].join('\n'),
        summary: `Session ID verified. Bearer token valid. Session header stripped. Encrypted payload passed to L6.`
      },
      6: {
        label: 'Decrypted + Decoded',
        code: [
          ` PRESENTATION LAYER — DECODING...`,
          ``,
          ` STEP 1: Decompress (gzip)`,
          ` Received: ~${compressedSize} bytes → Expanded: ${byteLen} bytes`,
          ``,
          ` STEP 2: Decrypt (AES-256-GCM)`,
          ` Ciphertext: ${cipherHex}`,
          ` IV/Nonce  : ${tlsIV}`,
          ` Auth Tag  : ${tlsTag}  ✓ verified`,
          ` Plaintext : ${hexStr}`,
          ``,
          ` STEP 3: Decode UTF-8`,
          ` Hex → "${msg}"`,
          ``,
          ` ✅ Decryption successful!`,
          ` ✅ Data integrity verified (auth tag OK)`,
          ` → Passing plain text to L7 Application`,
        ].join('\n'),
        summary: `Decompressed + Decrypted + Decoded. Your original message "${msg}" is now readable again!`
      },
      7: {
        label: 'Message Delivered to App!',
        code: [
          ` HTTP RESPONSE PARSED:`,
          ` ┌─────────────────────────────────────┐`,
          ` │ Method   : POST /send HTTP/1.1      │`,
          ` │ From     : ${srcIP}          │`,
          ` │ Content  : text/plain; charset=UTF-8│`,
          ` │ Length   : ${byteLen} bytes                 │`,
          ` └─────────────────────────────────────┘`,
          ``,
          ` MESSAGE RECEIVED:`,
          ` ╔═════════════════════════════════════╗`,
          ` ║  "${msg}"`,
          ` ╚═════════════════════════════════════╝`,
          ``,
          ` ✅ Message successfully delivered!`,
          ` ✅ All OSI layers processed correctly`,
          ` 🎉 Journey complete in ~15ms (LAN)`,
        ].join('\n'),
        summary: `🎉 "${msg}" delivered successfully! The full OSI journey from L7→L1→L7 is complete.`
      }
    }
  };
}

/* =============================================================================
   APPLICATION STATE
   ============================================================================= */
const state = {
  currentStep:    0,          // 0–6 (step index, not layer number)
  flowDirection:  'sender',   // 'sender' (encap 7→1) | 'receiver' (decap 1→7)
  isAutoPlaying:  false,
  autoPlayInterval: null,
  drawerOpen:     false,
  journeyOpen:    false,
};

/** The journey object — recomputed whenever message changes */
let journey = computeJourney('Hello, World!');

/* =============================================================================
   HELPERS
   ============================================================================= */
const $ = id => document.getElementById(id);
const TOTAL_STEPS = 7;

/** Returns OSI_LAYERS index (0=L7, 6=L1) for the current step */
function getCurrentLayerIndex() {
  return state.flowDirection === 'sender'
    ? state.currentStep
    : 6 - state.currentStep;
}

/** Returns the layer data for the current step */
function getCurrentLayer() { return OSI_LAYERS[getCurrentLayerIndex()]; }

/* =============================================================================
   PACKET BLOCK DEFINITIONS — real message content per layer
   ============================================================================= */
/**
 * Returns the visual packet blocks for the packet visualizer.
 * Blocks are objects: { label, type, color }
 * type = 'header' | 'payload' | 'trailer' | 'sep'
 */
function getPacketBlocks(layerNum, flowDir) {
  const j = journey;
  const raw = j.raw;
  const shortMsg = raw.length > 10 ? raw.substring(0, 10) + '…' : raw;
  const shortMac = (mac) => mac.substring(0, 8) + '…';

  // Helper block factory
  const h = (label, colorVar, isNew) => ({ label, type: 'header', colorVar, isNew: !!isNew });
  const t = (label, colorVar, isNew) => ({ label, type: 'trailer', colorVar, isNew: !!isNew });
  const p = (label) => ({ label, type: 'payload', colorVar: '--accent-primary' });
  const sep = () => ({ label: '│', type: 'sep', colorVar: '--text-muted' });

  if (flowDir === 'sender') {
    switch (layerNum) {
      case 7: return [p(`"${shortMsg}"`)];
      case 6: return [h('TLS Header', '--layer-6-color', true), sep(), p(`AES("${shortMsg}")`)];
      case 5: return [h(`SID:${j.sessId.substring(0,6)}…`, '--layer-5-color', true), sep(), p(`Enc(${shortMsg})`)];
      case 4: return [h(`TCP ${j.srcPort}→${j.dstPort}`, '--layer-4-color', true), sep(), p(`Enc(${shortMsg})`)];
      case 3: return [h(`IP ${j.srcIP}`, '--layer-3-color', true), sep(), h(`→${j.dstIP}`, '--layer-3-color'), sep(), h(`TCP hdr`, '--layer-4-color'), sep(), p(`Enc(${shortMsg})`)];
      case 2: return [h(`ETH ${shortMac(j.srcMAC)}`, '--layer-2-color', true), sep(), h(`IP`, '--layer-3-color'), sep(), h(`TCP`, '--layer-4-color'), sep(), p(`Enc(${shortMsg})`), sep(), t(`FCS ${j.crc32.substring(0,6)}…`, '--layer-2-color', true)];
      case 1: return null; // binary stream
    }
  } else {
    // Receiver side (decapsulation — headers being REMOVED)
    switch (layerNum) {
      case 1: return null; // bits
      case 2: return [h(`ETH ${shortMac(j.srcMAC)}`, '--layer-2-color'), sep(), h(`IP`, '--layer-3-color'), sep(), h(`TCP`, '--layer-4-color'), sep(), p(`Enc(${shortMsg})`), sep(), t(`FCS ✓`, '--layer-2-color')];
      case 3: return [h(`IP ${j.srcIP}→${j.dstIP} ✓`, '--layer-3-color'), sep(), h(`TCP`, '--layer-4-color'), sep(), p(`Enc(${shortMsg})`)];
      case 4: return [h(`TCP ${j.srcPort}→${j.dstPort} ✓`, '--layer-4-color'), sep(), p(`Enc(${shortMsg})`)];
      case 5: return [h(`SID:${j.sessId.substring(0,6)}… ✓`, '--layer-5-color'), sep(), p(`Enc(${shortMsg})`)];
      case 6: return [p(`"${shortMsg}"`)]; // decrypted, show plain message
      case 7: return [p(`"${raw}"`)];      // fully delivered
    }
  }
  return [p(shortMsg)];
}

/* =============================================================================
   RENDER — Top-level render function
   Called on every state change. Reads `state` + `journey`, updates DOM.
   ============================================================================= */
function render() {
  const layer   = getCurrentLayer();
  const stepNum = state.currentStep + 1;

  // 1. Step indicator
  const dirLabel = state.flowDirection === 'sender' ? '↓ Sender' : '↑ Receiver';
  $('step-indicator').textContent = `${dirLabel} · Step ${stepNum}/7 · ${layer.name}`;

  // 2. Progress bar
  $('progress-bar-fill').style.width = `${(stepNum / TOTAL_STEPS) * 100}%`;

  // 3. Flow toggle
  document.querySelectorAll('.flow-toggle-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.flow === state.flowDirection)
  );

  // 4. Nav button states
  $('btn-prev').disabled = state.currentStep === 0;
  $('btn-next').disabled = state.currentStep === TOTAL_STEPS - 1;

  // 5. Auto-play button
  const autoBtn = $('btn-auto');
  if (state.isAutoPlaying) {
    autoBtn.innerHTML = `<span class="autoplay-spinner"></span> Pause`;
    autoBtn.classList.add('paused'); autoBtn.classList.remove('primary');
  } else {
    autoBtn.innerHTML = `▶ Auto-Play`;
    autoBtn.classList.add('primary'); autoBtn.classList.remove('paused');
  }

  // 6. Message display in header
  $('composer-display-msg').textContent = `"${journey.raw}"`;

  // 7. Panels
  renderLayerStack();
  renderPacketVisualizer(layer);
  renderLayerDetail(layer);
}

/* =============================================================================
   RENDER — Left Panel: Layer Stack
   ============================================================================= */
function renderLayerStack() {
  const container = $('layer-stack-panel');
  const activeIdx = getCurrentLayerIndex();

  // Update flow direction label
  const flowLabelEl = document.getElementById('stack-flow-label');
  if (flowLabelEl) {
    flowLabelEl.textContent = state.flowDirection === 'sender'
      ? '▼ Sender: Encapsulation (7→1)'
      : '▲ Receiver: Decapsulation (1→7)';
  }

  OSI_LAYERS.forEach((layerData, idx) => {
    const card = container.querySelector(`[data-layer="${layerData.num}"]`);
    if (!card) return;

    card.classList.remove('active', 'completed', 'pending');
    const isCompleted = state.flowDirection === 'sender' ? idx < activeIdx : idx > activeIdx;

    if (idx === activeIdx) {
      card.classList.add('active');
      card.querySelector('.tower-status').textContent = '⚙';
      card.querySelector('.tower-num').textContent = layerData.num;
    } else if (isCompleted) {
      card.classList.add('completed');
      card.querySelector('.tower-status').textContent = '✓';
      card.querySelector('.tower-num').textContent = '✓';
    } else {
      card.classList.add('pending');
      card.querySelector('.tower-status').textContent = '';
      card.querySelector('.tower-num').textContent = layerData.num;
    }
  });
}

/* =============================================================================
   RENDER — Packet Visualizer (v3 — encapsulation WRAP animation)
   ============================================================================= */

/**
 * Per-layer byte overhead constants (header/trailer sizes).
 * sender: headers added top → bottom (L7→L1).
 * receiver: those same headers stripped.
 */
const LAYER_OVERHEAD = {
  7: { label: 'HTTP Req',   bytes: 0,  color: 'var(--layer-7-color)', detail: (j) => ({ 'Method': 'POST /send HTTP/1.1', 'Host': 'chat.example.com', 'Content-Type': 'text/plain; UTF-8', 'Content-Length': `${j.byteLen} bytes` }) },
  6: { label: 'TLS Hdr',   bytes: 21, color: 'var(--layer-6-color)', detail: (j) => ({ 'TLS Version': '1.3', 'IV/Nonce': j.tlsIV, 'Auth Tag': j.tlsTag, 'Cipher': 'AES-256-GCM' }) },
  5: { label: 'Session',   bytes: 36, color: 'var(--layer-5-color)', detail: (j) => ({ 'Session-ID': j.sessId, 'Duplex': 'Full', 'Bearer': 'verified ✓' }) },
  4: { label: 'TCP Seg',   bytes: 20, color: 'var(--layer-4-color)', detail: (j) => ({ 'Src Port': j.srcPort, 'Dst Port': j.dstPort, 'Seq #': j.seqNum, 'Flags': 'PSH|ACK', 'Checksum': j.checksum }) },
  3: { label: 'IP Hdr',    bytes: 20, color: 'var(--layer-3-color)', detail: (j) => ({ 'Src IP': j.srcIP, 'Dst IP': j.dstIP, 'TTL': 64, 'Protocol': 'TCP(6)', 'ID': j.ipId }) },
  2: { label: 'ETH Frame', bytes: 18, color: 'var(--layer-2-color)', detail: (j) => ({ 'Src MAC': j.srcMAC, 'Dst MAC': j.dstMAC, 'EtherType': '0x0800', 'FCS CRC-32': j.crc32 }) },
  1: { label: 'PHY Bits',  bytes: 0,  color: 'var(--layer-1-color)', detail: (j) => ({ 'Bit count': `${j.bitLen} bits`, 'Hex': j.hexStr.substring(0,20)+'…', 'Speed': '1 Gbps', 'Medium': 'Cat6 Ethernet' }) },
};

function renderPacketVisualizer(layer) {
  const binaryCt = $('binary-stream-container');
  const pduPill  = $('pdu-label-pill');
  const wrapStage = $('packet-wrap-stage');
  const byteCounter = $('packet-byte-counter');

  pduPill.textContent = `PDU: ${layer.pdu}`;
  pduPill.style.cssText = `border-color:${layer.color};color:${layer.color};`;

  // Update the network flow pill
  const nfPill = $('nf-active-pill');
  if (nfPill) {
    nfPill.textContent = `Layer ${layer.num} — ${layer.name}`;
    nfPill.style.color = layer.color;
    nfPill.style.borderColor = layer.color;
  }

  // Physical layer → binary stream
  if (layer.num === 1) {
    binaryCt.classList.add('active');
    wrapStage.innerHTML = `<span style="font-size:0.72rem;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">Raw bits on physical medium ↓</span>`;
    const stream = journey.binaryStr;
    $('binary-stream').innerHTML = stream.split('').map(c =>
      `<span class="binary-bit">${c}</span>`
    ).join('');
    animateBinaryBits();
    byteCounter.innerHTML = `<span class="byte-total">⚡ ${journey.bitLen} bits transmitted</span><span class="byte-divider">·</span><span class="byte-seg-label">${journey.byteLen} bytes → wire</span>`;
    return;
  } else {
    binaryCt.classList.remove('active');
  }

  renderPacketWrapStage(layer);
  renderByteCounter(layer);
}

/**
 * Renders the new encapsulation wrap animation.
 * Sender: layers accumulate as nested bands (bottom payload = message, outer bands = headers).
 * Receiver: bands are shown as "stripping" / faded.
 */
function renderPacketWrapStage(layer) {
  const wrapStage = $('packet-wrap-stage');
  if (!wrapStage) return;
  const isSender = state.flowDirection === 'sender';
  const layerNum = layer.num;
  const j = journey;
  const shortMsg = j.raw.length > 12 ? j.raw.substring(0, 12) + '…' : j.raw;

  // Determine which layers are visible at this step
  // Sender: layers 7 down to current are shown (newest outer band first)
  // Receiver: layers 1 up to current are shown (currently stripping newest)

  let bands = [];
  if (isSender) {
    // Layers from L7 down to current layer
    // In OSI_LAYERS array: index 0 = L7, index 6 = L1
    // Current layer is layer.num. Show all from 7 down to layerNum.
    for (let n = 7; n >= layerNum; n--) {
      const info = LAYER_OVERHEAD[n];
      const isNew = n === layerNum;
      bands.push({ num: n, info, isNew, stripping: false });
    }
  } else {
    // Receiver: layers from L1 up to current layer
    // Show layers 1..layerNum. The current one is being stripped.
    for (let n = 1; n <= layerNum; n++) {
      const info = LAYER_OVERHEAD[n];
      const isStripping = n === layerNum;
      bands.push({ num: n, info, isNew: false, stripping: isStripping });
    }
    bands.reverse(); // outermost (highest layer processed so far) first
  }

  wrapStage.innerHTML = '';
  const stack = document.createElement('div');
  stack.className = 'enc-stack';

  bands.forEach((band, i) => {
    if (band.num === 7 && isSender) {
      // Application layer = payload only
      const payload = document.createElement('div');
      payload.className = 'enc-payload';
      payload.textContent = `"${shortMsg}"`;
      stack.appendChild(payload);
      return;
    }

    const div = document.createElement('div');
    div.className = 'enc-band';
    if (band.isNew) div.classList.add('new-band');
    if (band.stripping) div.classList.add('stripping');

    const color = band.info.color;
    div.style.borderColor = `color-mix(in srgb, ${color} 45%, transparent)`;
    div.style.backgroundColor = `color-mix(in srgb, ${color} 6%, transparent)`;
    div.style.animationDelay = `${i * 35}ms`;

    // Header label (left side)
    const labelEl = document.createElement('span');
    labelEl.className = 'enc-band-label';
    labelEl.style.color = color;
    labelEl.style.background = `color-mix(in srgb, ${color} 12%, transparent)`;
    labelEl.textContent = band.info.label;
    div.appendChild(labelEl);

    // Inner content area
    const inner = document.createElement('div');
    inner.className = 'enc-band-inner';
    if (i === bands.length - 1 && !isSender) {
      // Bottom of receiver stack = original message emerging
      inner.textContent = `"${shortMsg}" ← decrypted payload`;
      inner.style.color = 'var(--accent-primary)';
    } else if (band.num === 7) {
      inner.textContent = `"${shortMsg}"`;
    } else if (band.num === 1) {
      inner.textContent = `${journey.bitLen} bits on wire`;
    } else if (band.num === 2) {
      inner.textContent = `MAC ${journey.srcMAC.substring(0,8)}… → ${journey.dstMAC.substring(0,8)}… | FCS ${journey.crc32.substring(0,8)}…`;
    } else if (band.num === 3) {
      inner.textContent = `${journey.srcIP} → ${journey.dstIP} | TTL:64`;
    } else if (band.num === 4) {
      inner.textContent = `TCP ${journey.srcPort}→${journey.dstPort} | Seq:${journey.seqNum} | PSH+ACK`;
    } else if (band.num === 5) {
      inner.textContent = `Session-ID: ${journey.sessId.substring(0,8)}…`;
    } else if (band.num === 6) {
      inner.textContent = `TLS-IV:${journey.tlsIV.substring(0,8)}… | AES-256-GCM`;
    } else {
      inner.textContent = band.isNew ? '[wrapped]' : '[payload]';
    }
    div.appendChild(inner);

    // Click to inspect
    div.classList.add('clickable');
    div.addEventListener('click', (e) => openPacketInspector(e, band.num, band.info, color));

    stack.appendChild(div);

    // For receiver, place the payload at the bottom
    if (!isSender && i === bands.length - 1) {
      const payload = document.createElement('div');
      payload.className = 'enc-payload';
      payload.textContent = layerNum === 7 ? `🎉 "${journey.raw}" — delivered!` : `"${shortMsg}" [encrypted]`;
      stack.appendChild(payload);
    }
  });

  // For sender: add payload inside innermost band
  if (isSender && layerNum !== 7) {
    const payNote = document.createElement('div');
    payNote.style.cssText = 'font-size:0.6rem;color:var(--text-muted);font-family:"JetBrains Mono",monospace;margin-top:4px;text-align:center;';
    payNote.textContent = `↑ click any band to inspect header fields`;
    wrapStage.appendChild(stack);
    wrapStage.appendChild(payNote);
    return;
  }

  wrapStage.appendChild(stack);
}

/** Renders the byte counter breakdown */
function renderByteCounter(layer) {
  const counter = $('packet-byte-counter');
  if (!counter) return;
  const isSender = state.flowDirection === 'sender';
  const j = journey;
  const layerNum = layer.num;

  // Compute total overhead so far
  let payloadBytes = j.byteLen;
  let headerBytes = 0;
  let segments = [];

  if (isSender) {
    // Accumulate overhead from L7 down to current layer
    segments.push({ label: 'Payload', bytes: payloadBytes, color: 'var(--accent-primary)' });
    for (let n = 6; n >= layerNum; n--) {
      const oh = LAYER_OVERHEAD[n].bytes;
      if (oh > 0) {
        headerBytes += oh;
        segments.push({ label: LAYER_OVERHEAD[n].label, bytes: oh, color: LAYER_OVERHEAD[n].color });
      }
    }
  } else {
    // Receiver: show bytes being stripped
    for (let n = 1; n <= layerNum; n++) {
      const oh = LAYER_OVERHEAD[n].bytes;
      if (oh > 0) headerBytes += oh;
    }
    payloadBytes = j.byteLen + Object.values(LAYER_OVERHEAD).reduce((s, v) => s + v.bytes, 0) - headerBytes;
    segments.push({ label: 'Remaining', bytes: payloadBytes, color: 'var(--accent-primary)' });
  }

  const total = payloadBytes + headerBytes;
  counter.innerHTML = [
    segments.map(s => `<span class="byte-seg"><span class="byte-seg-color" style="background:${s.color};"></span><span class="byte-seg-label">${s.label}</span> <span class="byte-seg-val">${s.bytes}B</span></span>`).join('<span class="byte-divider">+</span>'),
    `<span class="byte-divider">=</span>`,
    `<span class="byte-total">${total}B total</span>`
  ].join('');
}

/** Animate bits lighting up sequentially */
function animateBinaryBits() {
  const bits = document.querySelectorAll('#binary-stream .binary-bit');
  if (!bits.length) return;
  let i = 0;
  const iv = setInterval(() => {
    bits.forEach(b => b.classList.remove('lit'));
    for (let j = i; j < Math.min(i + 9, bits.length); j++) bits[j].classList.add('lit');
    i = (i + 4) % bits.length;
    if (!$('binary-stream-container').classList.contains('active')) clearInterval(iv);
  }, 100);
}

/* =============================================================================
   RENDER — Layer Detail Card
   Shows: layer title, what-happens, analogy, devices, AND the new
   "Message at this Layer" code block showing actual message data.
   ============================================================================= */
function renderLayerDetail(layer) {
  // Badge
  const badge = $('detail-badge');
  badge.style.background = `color-mix(in srgb, ${layer.color} 12%, transparent)`;
  badge.style.borderColor = `color-mix(in srgb, ${layer.color} 35%, transparent)`;
  badge.style.color = layer.color;
  badge.style.boxShadow = `0 0 14px color-mix(in srgb, ${layer.color} 20%, transparent)`;
  badge.querySelector('.badge-num').textContent = `L${layer.num}`;
  badge.querySelector('.badge-icon').textContent = layer.icon;

  // Title
  const title = $('detail-layer-title');
  title.textContent = `${layer.name} Layer`;
  title.style.color = layer.color;
  $('detail-layer-subtitle').textContent = `Layer ${layer.num} · PDU: ${layer.pdu}`;

  // What happens
  $('what-happens-list').innerHTML = layer.what.map(item =>
    `<li><span class="arrow" style="color:${layer.color}">→</span> ${item}</li>`
  ).join('');

  // Analogy
  $('analogy-text').textContent = layer.analogy;
  $('analogy-text').style.borderLeftColor = layer.color;

  // Devices
  $('devices-list').innerHTML = layer.devices.map(d =>
    `<span class="device-chip" style="background:color-mix(in srgb,${layer.color} 8%,transparent);border-color:color-mix(in srgb,${layer.color} 22%,transparent);color:${layer.color};">${d}</span>`
  ).join('');

  // Quick facts
  $('quick-facts-body').innerHTML = Object.entries(layer.facts).map(([k, v]) =>
    `<div class="fact-row"><span class="fact-key">${k}</span><span class="fact-val">${v}</span></div>`
  ).join('');

  // SVG
  $('layer-svg-diagram').innerHTML = getSvgForLayer(layer.num);
  $('layer-svg-diagram').style.borderColor = `color-mix(in srgb, ${layer.color} 25%, var(--border-subtle))`;

  // ★ NEW: Message at this Layer
  renderMessageAtLayer(layer);

  // Animate
  $('layer-detail-card').classList.remove('content-fade');
  void $('layer-detail-card').offsetWidth;
  $('layer-detail-card').classList.add('content-fade');
}

/**
 * Renders the "Your message at this layer" code block.
 * Shows the actual computed transformation for `journey.raw`.
 */
function renderMessageAtLayer(layer) {
  const box = $('msg-at-layer-box');
  if (!box) return;

  const side  = state.flowDirection === 'sender' ? journey.sender : journey.receiver;
  const data  = side[layer.num];
  if (!data) return;

  const color = layer.color;

  // Label line (sender adds / receiver strips)
  const action = state.flowDirection === 'sender'
    ? `<span style="color:#34d399">↓ SENDER ADDS</span>`
    : `<span style="color:#a78bfa">↑ RECEIVER STRIPS</span>`;

  box.innerHTML = `
    <div class="mal-header" style="border-left-color:${color};">
      <div class="mal-title" style="color:${color};">
        ${layer.icon} Your message at <strong>${layer.name} Layer</strong>
        <span class="mal-action">${action}</span>
      </div>
      <div class="mal-label">${data.label}</div>
    </div>
    <pre class="mal-code" id="mal-code-content" style="border-color:${color}20;">${escapeHtml(data.code)}</pre>
    <div class="mal-summary" style="border-left-color:${color};">
      💡 ${data.summary}
    </div>
  `;

  // Syntax highlight: highlight the raw message within the code block
  const codeEl = $('mal-code-content');
  if (codeEl && journey.raw.length > 0) {
    const escaped = escapeHtml(journey.raw);
    codeEl.innerHTML = codeEl.innerHTML.replace(
      new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      `<mark class="msg-highlight">${escaped}</mark>`
    );
  }
}

/** Escapes HTML special characters */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =============================================================================
   FULL JOURNEY OVERLAY
   Shows sender (L7→L1) and receiver (L1→L7) side-by-side with real message data
   ============================================================================= */
function openFullJourney() {
  state.journeyOpen = true;
  const overlay = $('full-journey-overlay');
  overlay.classList.add('open');

  // Update message in overlay header
  $('fjo-message-display').textContent = `"${journey.raw}"`;

  // Build sender column (L7 → L1, top to bottom)
  const senderCol = $('fjo-sender-layers');
  senderCol.innerHTML = '';
  OSI_LAYERS.forEach((layer) => {
    const data = journey.sender[layer.num];
    senderCol.appendChild(buildJourneyRow(layer, data, 'sender'));
  });

  // Build receiver column (L1 → L7, displayed top-to-bottom but labelled 1→7)
  const receiverCol = $('fjo-receiver-layers');
  receiverCol.innerHTML = '';
  [...OSI_LAYERS].reverse().forEach((layer) => {
    const data = journey.receiver[layer.num];
    receiverCol.appendChild(buildJourneyRow(layer, data, 'receiver'));
  });

  document.body.style.overflow = 'hidden';
}

function closeFullJourney() {
  state.journeyOpen = false;
  $('full-journey-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Builds a single journey row card (used in the Full Journey overlay).
 */
function buildJourneyRow(layer, data, side) {
  const div = document.createElement('div');
  div.className = 'fjo-layer-row';
  div.style.setProperty('--layer-color', layer.color);

  const actionArrow = side === 'sender' ? '↓ Adds' : '↑ Strips';
  const shortCode   = data.code.split('\n').slice(0, 6).join('\n') + (data.code.split('\n').length > 6 ? '\n...' : '');

  div.innerHTML = `
    <div class="fjo-row-header">
      <span class="fjo-row-num" style="background:color-mix(in srgb,${layer.color} 15%,transparent);color:${layer.color};border-color:color-mix(in srgb,${layer.color} 30%,transparent);">${layer.icon} L${layer.num}</span>
      <span class="fjo-row-name" style="color:${layer.color};">${layer.name}</span>
      <span class="fjo-row-pdu">${layer.pdu}</span>
    </div>
    <div class="fjo-row-label">${data.label}</div>
    <pre class="fjo-row-code" style="border-color:${layer.color}20;">${escapeHtml(shortCode)}</pre>
    <div class="fjo-row-summary">${data.summary}</div>
  `;
  return div;
}

/* =============================================================================
   NAVIGATION
   ============================================================================= */
function goToStep(step) {
  if (step < 0 || step >= TOTAL_STEPS) return;
  state.currentStep = step;
  render();
}

function stepNext() {
  if (state.currentStep < TOTAL_STEPS - 1) goToStep(state.currentStep + 1);
  else stopAutoPlay();
}

function stepPrev() { goToStep(state.currentStep - 1); }

function reset() {
  stopAutoPlay();
  state.currentStep = 0;
  render();
}

function startAutoPlay() {
  if (state.currentStep === TOTAL_STEPS - 1) state.currentStep = 0;
  state.isAutoPlaying = true;
  state.autoPlayInterval = setInterval(() => {
    if (state.currentStep >= TOTAL_STEPS - 1) stopAutoPlay();
    else stepNext();
  }, 2400);
  render();
}

function stopAutoPlay() {
  state.isAutoPlaying = false;
  if (state.autoPlayInterval) { clearInterval(state.autoPlayInterval); state.autoPlayInterval = null; }
  render();
}

function toggleAutoPlay() {
  state.isAutoPlaying ? stopAutoPlay() : startAutoPlay();
}

function setFlowDirection(dir) {
  if (state.flowDirection === dir) return;
  stopAutoPlay();
  state.flowDirection = dir;
  state.currentStep = 0;
  render();
}

/* =============================================================================
   MESSAGE UPDATE
   Called when user types a new message and clicks "Apply"
   ============================================================================= */
function applyMessage() {
  const input = $('live-msg-input');
  const msg = input.value.trim();
  if (!msg) { input.classList.add('input-error'); setTimeout(() => input.classList.remove('input-error'), 600); return; }
  journey = computeJourney(msg);
  state.currentStep = 0;
  render();
  // Flash to indicate update
  input.style.borderColor = '#34d399';
  setTimeout(() => input.style.borderColor = '', 800);
}

/* =============================================================================
   PACKET INSPECTOR POPOVER
   ============================================================================= */
let _inspectorActive = false;

function openPacketInspector(event, layerNum, info, color) {
  event.stopPropagation();
  const overlay = $('pkt-inspector-overlay');
  if (!overlay) return;
  _inspectorActive = true;

  const fields = info.detail ? info.detail(journey) : {};
  const rows = Object.entries(fields).map(([k, v]) =>
    `<div class="pki-row"><span class="pki-key">${k}</span><span class="pki-val" style="color:${color}">${v}</span></div>`
  ).join('');

  overlay.innerHTML = `
    <div class="pkt-inspector-popover" id="pki-popover" style="border-top:3px solid ${color};">
      <div class="pki-header">
        <span class="pki-title" style="color:${color}">${info.label} — ${layerNum > 1 ? info.bytes + 'B overhead' : 'Physical'}</span>
        <button class="pki-close" onclick="closePacketInspector()" aria-label="Close">✕</button>
      </div>
      <div class="pki-fields">${rows}</div>
    </div>
  `;
  overlay.style.pointerEvents = 'none';

  // Position near click
  const pop = overlay.querySelector('#pki-popover');
  pop.style.position = 'fixed';
  const rect = event.target.getBoundingClientRect();
  let top = rect.bottom + 8;
  let left = rect.left;
  if (left + 340 > window.innerWidth) left = window.innerWidth - 350;
  if (top + 300 > window.innerHeight) top = rect.top - 300;
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
  pop.style.pointerEvents = 'all';

  overlay.setAttribute('aria-hidden', 'false');
}

function closePacketInspector() {
  const overlay = $('pkt-inspector-overlay');
  if (overlay) { overlay.innerHTML = ''; overlay.setAttribute('aria-hidden', 'true'); }
  _inspectorActive = false;
}

/* =============================================================================
   ANIMATED NETWORK FLOW — Canvas-based animation
   Renders a miniature network topology and animates a packet traversing it
   based on which OSI layer is active.
   ============================================================================= */
let _nfAnimFrame = null;
let _nfPacketPos = 0;   // 0.0 – 1.0 progress along the path
let _nfLastLayer = -1;

// Network topology nodes: [id, labelEmoji, x-fraction, y-fraction, color, description]
const NF_NODES = [
  { id: 'pc',      emoji: '💻', xf: 0.05, yf: 0.5, color: '#38bdf8', label: 'Your PC'   },
  { id: 'switch',  emoji: '🔀', xf: 0.28, yf: 0.5, color: '#34d399', label: 'Switch'    },
  { id: 'router',  emoji: '🌐', xf: 0.50, yf: 0.5, color: '#f87171', label: 'Router'    },
  { id: 'internet',emoji: '☁️', xf: 0.72, yf: 0.5, color: '#f59e0b', label: 'Internet'  },
  { id: 'server',  emoji: '🖥️', xf: 0.95, yf: 0.5, color: '#a78bfa', label: 'Server'    },
];

// How far along the path the active packet is for each OSI layer
const LAYER_PACKET_POS = { 7: 0.0, 6: 0.05, 5: 0.1, 4: 0.2, 3: 0.5, 2: 0.3, 1: 0.45 };

function initNetworkFlowCanvas() {
  const canvas = $('network-flow-canvas');
  if (!canvas) return;

  // Set physical pixel size for sharpness
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function drawFrame(timestamp) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio;

    ctx.clearRect(0, 0, W, H);

    const layer = getCurrentLayer();
    const layerColor = layer.color;
    const targetPos = LAYER_PACKET_POS[layer.num] ?? 0;

    // Smoothly move packet toward target position
    const speed = 0.012;
    if (Math.abs(_nfPacketPos - targetPos) > 0.005) {
      _nfPacketPos += (_nfPacketPos < targetPos ? 1 : -1) * speed;
    } else {
      _nfPacketPos = targetPos;
    }

    // ─── Draw connections ───
    ctx.lineWidth = 2 * dpr;
    NF_NODES.forEach((node, i) => {
      if (i === 0) return;
      const prev = NF_NODES[i - 1];
      const x1 = prev.xf * W;
      const y1 = prev.yf * H;
      const x2 = node.xf * W;
      const y2 = node.yf * H;

      // Gradient line
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, prev.color + '55');
      grad.addColorStop(1, node.color + '55');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // ─── Active connection glow (the active segment) ───
    const activeNodeIdx = Math.min(Math.floor(_nfPacketPos * (NF_NODES.length - 1)), NF_NODES.length - 2);
    if (activeNodeIdx >= 0 && activeNodeIdx < NF_NODES.length - 1) {
      const n1 = NF_NODES[activeNodeIdx];
      const n2 = NF_NODES[activeNodeIdx + 1];
      ctx.lineWidth = 3 * dpr;
      ctx.strokeStyle = layerColor + 'aa';
      ctx.shadowColor = layerColor;
      ctx.shadowBlur = 12 * dpr;
      ctx.beginPath();
      ctx.moveTo(n1.xf * W, n1.yf * H);
      ctx.lineTo(n2.xf * W, n2.yf * H);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ─── Draw nodes ───
    NF_NODES.forEach((node, i) => {
      const x = node.xf * W;
      const y = node.yf * H;
      const r = 18 * dpr;

      // Outer glow for active nodes
      const isActiveNode = Math.round(_nfPacketPos * (NF_NODES.length - 1)) === i;
      if (isActiveNode) {
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = layerColor + '22';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0f1420';
      ctx.fill();
      ctx.lineWidth = (isActiveNode ? 2.5 : 1.5) * dpr;
      ctx.strokeStyle = isActiveNode ? layerColor : node.color + '66';
      if (isActiveNode) { ctx.shadowColor = layerColor; ctx.shadowBlur = 10 * dpr; }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Emoji icon
      ctx.font = `${14 * dpr}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.emoji, x, y);

      // Label below node
      ctx.font = `${7.5 * dpr}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = isActiveNode ? layerColor : node.color + 'aa';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label, x, y + r + 3 * dpr);
    });

    // ─── Draw the travelling packet dot ───
    const totalPath = NF_NODES.length - 1;
    const seg = Math.min(_nfPacketPos * totalPath, totalPath - 0.001);
    const segIdx = Math.floor(seg);
    const segFrac = seg - segIdx;
    const pn1 = NF_NODES[segIdx];
    const pn2 = NF_NODES[segIdx + 1];
    const px = (pn1.xf + (pn2.xf - pn1.xf) * segFrac) * W;
    const py = (pn1.yf + (pn2.yf - pn1.yf) * segFrac) * H;
    const pr = 7 * dpr;

    // Outer glow ring
    const pulseScale = 1 + 0.3 * Math.sin(timestamp / 300);
    ctx.beginPath();
    ctx.arc(px, py, pr * pulseScale * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = layerColor + '28';
    ctx.fill();

    // Main dot
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = layerColor;
    ctx.shadowColor = layerColor;
    ctx.shadowBlur = 14 * dpr;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Packet label '📦'
    ctx.font = `${9 * dpr}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'transparent';
    ctx.fillText('📦', px, py - pr - 2 * dpr);

    _nfAnimFrame = requestAnimationFrame(drawFrame);
  }

  if (_nfAnimFrame) cancelAnimationFrame(_nfAnimFrame);
  _nfAnimFrame = requestAnimationFrame(drawFrame);
}

/* =============================================================================
   BUILD LAYER STACK — v3: 3D Tower
   ============================================================================= */
function buildLayerStack() {
  const container = $('layer-stack-panel');
  container.innerHTML = '';

  // Wrapper
  const wrap = document.createElement('div');
  wrap.id = 'layer-tower-wrap';

  // Spine connector
  const spine = document.createElement('div');
  spine.className = 'tower-spine';
  wrap.appendChild(spine);

  // Flow label
  const flowLabel = document.createElement('div');
  flowLabel.className = 'tower-flow-label';
  flowLabel.id = 'stack-flow-label';
  flowLabel.textContent = '▼ Sender: Encapsulation (7→1)';
  wrap.appendChild(flowLabel);

  OSI_LAYERS.forEach((layer, idx) => {
    if (idx > 0) {
      const conn = document.createElement('div');
      conn.className = 'tower-connector';
      wrap.appendChild(conn);
    }

    const card = document.createElement('div');
    card.className = 'tower-block pending';
    card.dataset.layer = layer.num;
    card.style.setProperty('--tower-color', layer.color);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Jump to Layer ${layer.num}: ${layer.name}`);
    card.innerHTML = `
      <div class="tower-num">${layer.num}</div>
      <div class="tower-info">
        <div class="tower-name">${layer.name}</div>
        <div class="tower-pdu">PDU: ${layer.pdu}</div>
        <div class="tower-protos">
          ${layer.protocols.slice(0, 3).map(p => `<span class="tower-proto-tag">${p}</span>`).join('')}
        </div>
      </div>
      <div class="tower-status"></div>
    `;

    card.addEventListener('click', () => {
      const targetIdx = OSI_LAYERS.findIndex(l => l.num === layer.num);
      const targetStep = state.flowDirection === 'sender' ? targetIdx : 6 - targetIdx;
      stopAutoPlay();
      goToStep(targetStep);
    });
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') card.click(); });

    wrap.appendChild(card);
  });

  container.appendChild(wrap);
}

/* =============================================================================
   EVENT LISTENERS
   ============================================================================= */
function initEventListeners() {
  // Nav
  $('btn-prev').addEventListener('click', stepPrev);
  $('btn-next').addEventListener('click', stepNext);
  $('btn-auto').addEventListener('click', toggleAutoPlay);
  $('btn-reset').addEventListener('click', reset);

  // Flow toggle
  document.querySelectorAll('.flow-toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => setFlowDirection(btn.dataset.flow))
  );

  // Message composer
  $('btn-apply-msg').addEventListener('click', applyMessage);
  $('live-msg-input').addEventListener('keydown', e => { if (e.key === 'Enter') applyMessage(); });

  // Full journey
  $('btn-full-journey').addEventListener('click', openFullJourney);
  $('btn-close-journey').addEventListener('click', closeFullJourney);
  $('full-journey-overlay').addEventListener('click', e => {
    if (e.target === $('full-journey-overlay')) closeFullJourney();
  });

  // Sandbox drawer
  $('sandbox-toggle-bar').addEventListener('click', () => {
    state.drawerOpen = !state.drawerOpen;
    $('sandbox-drawer').classList.toggle('open', state.drawerOpen);
    $('sandbox-toggle-bar').classList.toggle('open', state.drawerOpen);
    $('drawer-toggle-text').textContent = state.drawerOpen
      ? '⬇ Close Summary'
      : '⬆ View Complete Journey Summary (All Layers at Once)';
    if (state.drawerOpen) renderSandboxSummary();
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (state.journeyOpen && e.key === 'Escape') { closeFullJourney(); return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); stopAutoPlay(); stepNext(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); stopAutoPlay(); stepPrev(); }
    else if (e.key === ' ') { e.preventDefault(); toggleAutoPlay(); }
    else if (e.key === 'r' || e.key === 'R') reset();
    else if (e.key === 'j' || e.key === 'J') openFullJourney();
  });
}

/* =============================================================================
   SANDBOX / SUMMARY DRAWER
   Shows all 7 layers for the current message at once
   ============================================================================= */
function renderSandboxSummary() {
  const out = $('sandbox-output');
  if (!out) return;
  out.innerHTML = '';

  OSI_LAYERS.forEach(layer => {
    const data = journey.sender[layer.num];
    const row = document.createElement('div');
    row.className = 'sb-layer-row';
    row.style.setProperty('--row-color', layer.color);
    row.innerHTML = `
      <span class="sb-row-label">${layer.icon} L${layer.num} ${layer.shortName}</span>
      <span class="sb-row-data">${escapeHtml(data.summary)}</span>
    `;
    out.appendChild(row);
  });

  // Network info
  $('ni-src-ip').textContent  = journey.srcIP;
  $('ni-dst-ip').textContent  = journey.dstIP;
  $('ni-src-mac').textContent = journey.srcMAC;
  $('ni-dst-mac').textContent = journey.dstMAC;
}

/* =============================================================================
   INIT
   ============================================================================= */
function init() {
  buildLayerStack();
  initEventListeners();
  initNetworkFlowCanvas();
  // Close inspector when clicking outside
  document.addEventListener('click', (e) => {
    if (_inspectorActive && !e.target.closest('.pkt-inspector-popover') && !e.target.closest('.enc-band')) {
      closePacketInspector();
    }
  });
  render();
}

document.addEventListener('DOMContentLoaded', init);
