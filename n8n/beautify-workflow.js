/**
 * beautify-workflow.js
 *
 * Reorganizes the n8n workflow "Lola Bot - Ventas El Istmo" into a clean,
 * professional layout with sticky notes explaining each section.
 *
 * ONLY changes node positions and adds sticky notes.
 * Does NOT modify parameters, connections, credentials, or code.
 */

const https = require('https');
const http = require('http');

const WORKFLOW_ID = '2EZ0PqE6jOX9NHwo';
const BASE_URL = 'https://n8n.solucionesomicron.com';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

// ─── NEW POSITIONS FOR ALL EXISTING NODES ─────────────────────────────────────
// Organized left-to-right in clear sections with appropriate Y spacing.
const nodePositions = {
  // ── SECTION 1: ENTRADA (x: 0-400) ──────────────────────────────────────────
  'WhatsApp Webhook GET':       [60,  -100],
  'WhatsApp Webhook POST':      [60,   300],
  'Responder Verificacion':     [320, -100],
  'Extraer Datos':              [320,  300],
  'Responder 200':              [560,  200],

  // ── SECTION 2: PROCESAMIENTO (x: 500-800) ──────────────────────────────────
  'Marcar como Leido':          [560,  400],
  'Detectar Tipo':              [780,  400],

  // ── SECTION 2b: ROUTING from Detectar Tipo ─────────────────────────────────
  'Solo Texto':                 [1020, 300],
  'Solo Audio':                 [1020, 700],
  'Solo Imagen':                [1020, 1000],
  'Msg No Soportado':           [1020, 550],
  'Enviar Msg No Soportado':    [1260, 550],

  // ── SECTION 3: TEXTO PREP (x: 1200-1500) ──────────────────────────────────
  'Preparar Texto':             [1260, 300],
  'Es Comando Cadena?':         [1500, 300],

  // ── SECTION 3b: TEXT ROUTING ────────────────────────────────────────────────
  'No Es Cadena':               [1500, 460],
  'Verificar Estado Pedido':    [1740, 460],
  'Routear Pedido':             [1980, 460],

  // ── SECTION 4: CADENA PROMOCIONAL (x: 1740-2700, y: -200 to 0) ────────────
  'Generar Cadena':             [1740, -120],
  'Lista de Contactos':         [1980, -120],
  'Enviar Cadena':              [2220, -120],
  'Confirmar Envio al Admin':   [2460, -120],

  // ── SECTION 5: PEDIDOS INTELIGENTES (x: 2220-3200, y: 100-350) ────────────
  'Preparar Pedido Claude':     [2220, 160],
  'Claude Pedidos':             [2460, 160],
  'Procesar Respuesta Pedido':  [2700, 160],
  'Enviar Respuesta Pedido':    [2700, 360],
  'Notificar Admin Pedido':     [2940, 260],
  'Enviar Notif Admin WA':      [3180, 260],
  // Legacy sub-nodes for order process (kept but positioned near the flow)
  'Guardar Nombre':             [2220, 280],
  'Guardar Cantidad':           [2220, 360],
  'Confirmar Pedido':           [2460, 360],
  'Notif Admin Pedido':         [2940, 360],

  // ── SECTION 6: CLAUDE NORMAL (x: 2220-3800, y: 460-750) ───────────────────
  'Menu del Negocio':           [2220, 560],
  'Claude AI Lola':             [2460, 560],
  'Procesar Respuesta':         [2700, 560],
  'Preparar Notif Pedido':      [2940, 560],
  'Es Respuesta Texto?':        [3180, 660],
  'Es Respuesta Audio?':        [3180, 460],
  'Enviar WhatsApp':            [3420, 660],
  'OpenAI TTS':                 [3420, 460],
  'Subir Audio a WhatsApp':     [3660, 460],
  'Enviar Audio WhatsApp':      [3900, 460],
  'Tiene Pedido?':              [3180, 560],
  'WhatsApp Notif Admin':       [3420, 560],

  // ── SECTION 7: AUDIO (x: 1200-1800, y: 700) ──────────────────────────────
  'Obtener URL Audio':          [1260, 700],
  'Descargar Audio':            [1500, 700],
  'OpenAI Whisper':             [1740, 700],
  'Texto del Audio':            [1980, 700],

  // ── SECTION 8: IMAGEN (x: 1200-1800, y: 1000) ────────────────────────────
  'Obtener URL Imagen':         [1260, 1000],
  'Descargar Imagen':           [1500, 1000],
  'Texto de Imagen':            [1740, 1000],
};

// ─── STICKY NOTES ─────────────────────────────────────────────────────────────
const stickyNotes = [
  {
    name: 'Note: Entrada WhatsApp',
    position: [-20, -200],
    width: 620,
    height: 660,
    color: 2, // blue
    content: '## \ud83d\udce5 Entrada WhatsApp\nRecibe mensajes de WhatsApp Cloud API.\n- **GET**: Verificaci\u00f3n del webhook\n- **POST**: Mensajes entrantes\n- Extrae datos del mensaje (texto, audio, imagen)',
  },
  {
    name: 'Note: Clasificacion',
    position: [480, 140],
    width: 620,
    height: 540,
    color: 6, // gray
    content: '## \ud83d\udd00 Clasificaci\u00f3n de Mensajes\nDetecta el tipo de mensaje y lo enruta:\n- \ud83d\udcdd Texto \u2192 Flujo de texto\n- \ud83c\udfa4 Audio \u2192 Transcripci\u00f3n\n- \ud83d\udcf7 Imagen \u2192 An\u00e1lisis\n- \u274c No soportado \u2192 Respuesta amigable',
  },
  {
    name: 'Note: Cadena Promocional',
    position: [1660, -260],
    width: 900,
    height: 280,
    color: 3, // pink
    content: '## \ud83d\udce2 Cadena Promocional\nEl admin escribe \'env\u00eda la cadena\' y Lola:\n1. Env\u00eda imagen del men\u00fa del d\u00eda\n2. A toda la lista de contactos\n3. Marca contactos para flujo de pedidos',
  },
  {
    name: 'Note: Pedidos Inteligentes',
    position: [2140, 80],
    width: 1140,
    height: 380,
    color: 5, // purple
    content: '## \ud83e\udde0 Pedidos con IA (Claude)\nCuando un contacto responde a la cadena:\n1. Claude recopila: cantidad, nombre, direcci\u00f3n\n2. Conversaci\u00f3n natural e inteligente\n3. Al completar \u2192 confirma + notifica admin',
  },
  {
    name: 'Note: Claude Chat Normal',
    position: [2140, 480],
    width: 1880,
    height: 340,
    color: 4, // green
    content: '## \ud83e\udd16 Claude AI - Restaurante\nConversaci\u00f3n general del restaurante:\n- Men\u00fa y precios\n- Recomendaciones\n- Toma pedidos del men\u00fa regular\n- Responde texto o audio',
  },
  {
    name: 'Note: Audio',
    position: [1180, 620],
    width: 900,
    height: 200,
    color: 1, // yellow
    content: '## \ud83c\udfa4 Procesamiento de Audio\n1. Obtiene URL del audio de WhatsApp\n2. Descarga el archivo\n3. OpenAI Whisper transcribe a texto\n4. Env\u00eda transcripci\u00f3n a Claude',
  },
  {
    name: 'Note: Imagen',
    position: [1180, 920],
    width: 700,
    height: 200,
    color: 1, // yellow
    content: '## \ud83d\udcf7 Procesamiento de Imagen\n1. Obtiene URL de la imagen\n2. Descarga el archivo\n3. Claude analiza la imagen\n4. Responde al cliente',
  },
];


// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}


// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Beautify n8n Workflow ===\n');

  // 1. GET the current workflow
  console.log('1. Fetching workflow...');
  const workflow = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  console.log(`   Name: ${workflow.name}`);
  console.log(`   Nodes BEFORE: ${workflow.nodes.length}`);

  // 2. Update positions for existing nodes
  console.log('\n2. Updating node positions...');
  let updated = 0;
  let notFound = [];

  for (const node of workflow.nodes) {
    if (nodePositions[node.name]) {
      node.position = nodePositions[node.name];
      updated++;
    } else {
      notFound.push(node.name);
    }
  }

  console.log(`   Updated positions: ${updated}`);
  if (notFound.length > 0) {
    console.log(`   Nodes NOT in position map (keeping original): ${notFound.join(', ')}`);
  }

  // Check for node names in position map that don't exist in workflow
  const existingNames = new Set(workflow.nodes.map(n => n.name));
  const missingInWorkflow = Object.keys(nodePositions).filter(n => !existingNames.has(n));
  if (missingInWorkflow.length > 0) {
    console.log(`   WARNING - Names in map not found in workflow: ${missingInWorkflow.join(', ')}`);
  }

  // 3. Create sticky note nodes
  console.log('\n3. Adding sticky notes...');
  const crypto = require('crypto');

  for (const note of stickyNotes) {
    const stickyNode = {
      parameters: {
        content: note.content,
        height: note.height,
        width: note.width,
        color: note.color,
      },
      id: crypto.randomUUID(),
      name: note.name,
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: note.position,
    };
    workflow.nodes.push(stickyNode);
    console.log(`   + ${note.name} at [${note.position}] (${note.width}x${note.height})`);
  }

  console.log(`   Nodes AFTER: ${workflow.nodes.length} (added ${stickyNotes.length} sticky notes)`);

  // 4. Build the PUT payload -- only include fields that n8n API accepts
  const putPayload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
    staticData: workflow.staticData,
  };

  // 5. PUT the updated workflow
  console.log('\n4. Saving workflow...');
  const result = await apiRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, putPayload);
  console.log(`   Saved! Nodes in response: ${result.nodes.length}`);

  // 6. Verify
  console.log('\n5. Verification:');
  const stickyCount = result.nodes.filter(n => n.type === 'n8n-nodes-base.stickyNote').length;
  const regularCount = result.nodes.filter(n => n.type !== 'n8n-nodes-base.stickyNote').length;
  console.log(`   Regular nodes: ${regularCount}`);
  console.log(`   Sticky notes:  ${stickyCount}`);
  console.log(`   Total:         ${result.nodes.length}`);

  // Spot-check a few positions
  console.log('\n6. Position spot-check:');
  const checkNodes = ['WhatsApp Webhook POST', 'Detectar Tipo', 'Claude AI Lola', 'Generar Cadena', 'OpenAI Whisper'];
  for (const name of checkNodes) {
    const node = result.nodes.find(n => n.name === name);
    if (node) {
      const expected = nodePositions[name];
      const match = node.position[0] === expected[0] && node.position[1] === expected[1];
      console.log(`   ${match ? 'OK' : 'MISMATCH'} ${name}: [${node.position}] ${match ? '' : '(expected [' + expected + '])'}`);
    }
  }

  console.log('\n=== Done! Workflow reorganized successfully. ===');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
