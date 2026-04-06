const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {
    if (node.name === 'Lista de Contactos') {
      node.parameters.jsCode = `
// ========== LISTA DE CONTACTOS ==========
const CONTACTOS = [
  { numero: "50769815135", nombre: "Vladimir" },
  { numero: "50768384242", nombre: "Veronica" },
];
// =========================================

const imageUrl = $input.first().json.imageUrl;
const caption  = $input.first().json.caption;

const staticData = $getWorkflowStaticData('global');
for (const c of CONTACTOS) {
  staticData['pedido_' + c.numero] = {
    estado: 'esperando_cantidad',
    nombre: c.nombre
  };
}

return CONTACTOS.map(c => ({
  json: { phoneNumber: c.numero, nombre: c.nombre, imageUrl, caption }
}));
`;
      console.log('✅ Lista actualizada: Vladimir + Veronica (sin Genesis)');
    }

    // Also set continueOnFail on Enviar Cadena so one failure doesnt block others
    if (node.name === 'Enviar Cadena') {
      node.onError = 'continueRegularOutput';
      console.log('✅ Enviar Cadena: continueOnFail activado');
    }
  }

  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  console.log(result.id ? '🚀 Guardado!' : 'Error: ' + JSON.stringify(result).substring(0, 200));
}
main();
