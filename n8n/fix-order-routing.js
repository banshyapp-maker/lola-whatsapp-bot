/**
 * fix-order-routing.js
 * Adds filtering to order flow nodes so they only process their specific route
 */

const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {

    // Guardar Cantidad: only process if _route === 'cantidad'
    if (node.name === 'Guardar Cantidad') {
      node.parameters.jsCode = `
const route = $input.first().json._route;
if (route !== 'cantidad') return [];

const staticData = $getWorkflowStaticData('global');
const phone    = $input.first().json.phoneNumber;
const cantidad = $input.first().json.messageContent;
const nombre   = $input.first().json.nombreContacto || phone;

staticData['pedido_' + phone] = {
  estado: 'esperando_direccion',
  cantidad: cantidad,
  nombre: nombre
};

return [{ json: {
  phoneNumber: phone,
  respuesta: '✅ *' + cantidad + '* anotado, ' + nombre + '! 📝\\n\\n📍 ¿Cuál es tu *dirección de entrega*?'
}}];
`;
      console.log('✅ Guardar Cantidad: filtrado por _route=cantidad');
    }

    // Confirmar Pedido: only process if _route === 'direccion'
    if (node.name === 'Confirmar Pedido') {
      node.parameters.jsCode = `
const route = $input.first().json._route;
if (route !== 'direccion') return [];

const staticData = $getWorkflowStaticData('global');
const phone     = $input.first().json.phoneNumber;
const direccion = $input.first().json.messageContent;
const pedido    = staticData['pedido_' + phone] || {};

const resumen = {
  telefono: phone,
  nombre:   pedido.nombre   || phone,
  cantidad: pedido.cantidad || 'N/A',
  direccion: direccion,
  hora: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' })
};

delete staticData['pedido_' + phone];

return [{ json: {
  phoneNumber: phone,
  respuesta: '🎉 *Pedido confirmado!*\\n\\n👤 ' + resumen.nombre + '\\n📦 Cantidad: ' + resumen.cantidad + '\\n📍 Dirección: ' + resumen.direccion + '\\n⏱️ En camino pronto!\\n\\nGracias por tu pedido! 😊🛵',
  pedidoFinal: resumen
}}];
`;
      console.log('✅ Confirmar Pedido: filtrado por _route=direccion');
    }

    // Preparar Texto: only process if _route === 'normal' (or no _route at all)
    if (node.name === 'Preparar Texto') {
      const currentCode = node.parameters.jsCode;
      // Add a guard at the top if not already there
      if (!currentCode.includes('_route')) {
        node.parameters.jsCode = `
// Guard: skip if this is an order flow message
const route = $input.first().json._route;
if (route && route !== 'normal') return [];

` + currentCode;
        console.log('✅ Preparar Texto: guard agregado para ignorar rutas de pedido');
      }
    }
  }

  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  if (result.id) {
    console.log('\n🚀 Workflow actualizado! Nodos:', result.nodes.length);
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 300));
  }
}

main().catch(console.error);
