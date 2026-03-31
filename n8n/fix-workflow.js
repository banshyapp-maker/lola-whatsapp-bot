const https = require('https');
const http = require('http');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const BASE = 'https://n8n.solucionesomicron.com/api/v1';
const WF_ID = '2EZ0PqE6jOX9NHwo';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(JSON.parse(chunks.join(''))));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Get current workflow
  const wf = await apiCall('GET', '/workflows/' + WF_ID);
  console.log('Got workflow:', wf.name);

  // Fix Detectar Tipo
  const detectarTipo = wf.nodes.find(n => n.name === 'Detectar Tipo');
  detectarTipo.parameters.jsCode = `const item = $('Extraer Datos').first().json;
const type = item.messageType;

if (type === 'text') {
  return [{ json: { ...item, route: 'text' } }];
} else if (type === 'audio') {
  return [{ json: { ...item, route: 'audio' } }];
} else if (type === 'image') {
  return [{ json: { ...item, route: 'image' } }];
} else {
  return [{ json: { ...item, route: 'unsupported' } }];
}`;

  // Fix Preparar Texto
  const prepararTexto = wf.nodes.find(n => n.name === 'Preparar Texto');
  prepararTexto.parameters.jsCode = `const item = $('Extraer Datos').first().json;

return [{
  json: {
    phoneNumber: item.phoneNumber,
    messageContent: item.messageContent
  }
}];`;

  // Fix Msg No Soportado - also read from Extraer Datos
  const msgNoSoportado = wf.nodes.find(n => n.name === 'Msg No Soportado');
  msgNoSoportado.parameters.jsCode = `const phoneNumber = $('Extraer Datos').first().json.phoneNumber;

return [{
  json: {
    phoneNumber,
    responseText: 'Hola! \\ud83d\\ude0a Por ahora puedo leer mensajes de texto, notas de voz e imagenes. Escribeme o mandame un audio con lo que necesites!'
  }
}];`;

  console.log('Fixed code nodes');

  // Update workflow
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings,
    staticData: wf.staticData
  };

  const result = await apiCall('PUT', '/workflows/' + WF_ID, payload);

  // Verify
  const dt = result.nodes.find(n => n.name === 'Detectar Tipo');
  const pt = result.nodes.find(n => n.name === 'Preparar Texto');
  console.log('Detectar Tipo fixed:', dt.parameters.jsCode.includes("Extraer Datos"));
  console.log('Preparar Texto fixed:', pt.parameters.jsCode.includes("Extraer Datos"));
  console.log('Workflow active:', result.active);
  console.log('DONE');
}

main().catch(e => console.error(e));
