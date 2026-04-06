const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

const prepCode = `
const route = $input.first().json._route;
if (route !== 'pedido') return [];

const staticData = $getWorkflowStaticData('global');
const phone = $input.first().json.phoneNumber;
const mensaje = $input.first().json.messageContent;
const pedido = staticData['pedido_' + phone] || { estado: 'en_pedido', historial: [], datos: { cantidad: '', nombre: '', direccion: '' } };

pedido.historial.push({ role: 'cliente', text: mensaje });
staticData['pedido_' + phone] = pedido;
staticData['_current_phone'] = phone;

const historialTexto = pedido.historial.map(function(h) { return h.role === 'cliente' ? 'Cliente: ' + h.text : 'Lola: ' + h.text; }).join(' | ');
const datosTexto = 'Cantidad: ' + (pedido.datos.cantidad || 'NO TIENE') + ', Nombre: ' + (pedido.datos.nombre || 'NO TIENE') + ', Direccion: ' + (pedido.datos.direccion || 'NO TIENE');

return [{ json: {
  phoneNumber: phone,
  historial: historialTexto,
  datosActuales: datosTexto,
  mensajeCliente: mensaje
}}];
`;

const procCode = `
const staticData = $getWorkflowStaticData('global');
const phone = staticData['_current_phone'] || '';

const apiResponse = $input.first().json;
let respuesta = '';
if (apiResponse.content && apiResponse.content[0]) {
  respuesta = apiResponse.content[0].text;
} else {
  respuesta = 'Lo siento, hubo un error. Intenta de nuevo.';
}

const marker = /\\[PEDIDO_LISTO\\|cantidad:(.+?)\\|nombre:(.+?)\\|direccion:(.+?)\\]/;
const match = respuesta.match(marker);
const respuestaLimpia = respuesta.replace(marker, '').trim();

const pedido = staticData['pedido_' + phone] || { historial: [], datos: {} };
pedido.historial.push({ role: 'lola', text: respuestaLimpia });

if (match) {
  const resumen = {
    telefono: phone,
    cantidad: match[1].trim(),
    nombre: match[2].trim(),
    direccion: match[3].trim(),
    hora: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' })
  };
  delete staticData['pedido_' + phone];
  delete staticData['_current_phone'];

  return [{ json: {
    phoneNumber: phone,
    respuesta: respuestaLimpia,
    pedidoCompleto: true,
    pedidoFinal: resumen
  }}];
} else {
  staticData['pedido_' + phone] = pedido;
  return [{ json: {
    phoneNumber: phone,
    respuesta: respuestaLimpia,
    pedidoCompleto: false,
    pedidoFinal: null
  }}];
}
`;

// Validate both
try { new Function(prepCode); console.log('✅ prepCode valid'); } catch(e) { console.log('❌ prepCode:', e.message); }
try { new Function(procCode); console.log('✅ procCode valid'); } catch(e) { console.log('❌ procCode:', e.message); }

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {
    if (node.name === 'Preparar Pedido Claude') {
      node.parameters.jsCode = prepCode;
      console.log('✅ Preparar Pedido Claude updated');
    }
    if (node.name === 'Procesar Respuesta Pedido') {
      node.parameters.jsCode = procCode;
      console.log('✅ Procesar Respuesta Pedido updated');
    }
  }

  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  console.log(result.id ? '🚀 Guardado!' : 'Error: ' + JSON.stringify(result).substring(0, 300));
}
main();
