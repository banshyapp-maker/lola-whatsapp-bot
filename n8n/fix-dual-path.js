const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {

    // FIX 1: "No Es Cadena" must block cadena commands
    if (node.name === 'No Es Cadena') {
      console.log('BEFORE No Es Cadena:', node.parameters.jsCode?.substring(0, 200) || JSON.stringify(node.parameters).substring(0, 200));

      node.parameters.jsCode = `
const msg = ($input.first().json.messageContent || "").toLowerCase().trim();
const esCadena = msg.includes("cadena") || msg.includes("manda la cadena") || msg.includes("manda cadena");
if (esCadena) return [];
return $input.all();
`;
      console.log('✅ No Es Cadena: ahora bloquea mensajes de cadena');
    }

    // FIX 2: "Es Comando Cadena?" - also verify it only passes admin commands
    if (node.name === 'Es Comando Cadena?') {
      node.parameters.jsCode = `
const ADMIN = "50768384242";
const item = $input.first().json;
const phone = item.phoneNumber;
const msg = (item.messageContent || "").toLowerCase().trim();
const esCadena = msg.includes("cadena");
const esAdmin = phone === ADMIN;

if (esAdmin && esCadena) {
  return [{ json: { ...item, esCadena: true } }];
} else {
  return [];
}
`;
      console.log('✅ Es Comando Cadena?: solo admin puede activar cadena');
    }

    // FIX 3: Remove duplicate "Cadena enviada" confirmations
    // Check Confirmar Envio al Admin node
    if (node.name === 'Confirmar Envio al Admin') {
      console.log('Confirmar Envio al Admin type:', node.type);
      console.log('Confirmar Envio params:', JSON.stringify(node.parameters).substring(0, 300));
    }
  }

  // Save
  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  console.log(result.id ? '\n🚀 Guardado!' : 'Error: ' + JSON.stringify(result).substring(0, 200));
}
main();
