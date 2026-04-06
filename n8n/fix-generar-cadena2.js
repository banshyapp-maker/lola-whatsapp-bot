const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';

const IMAGE_URL = 'https://raw.githubusercontent.com/banshyapp-maker/lola-whatsapp-bot/main/n8n/imagen-cadena.jpeg';

// Build the code as a proper string with escaped newlines
const jsCode = 'const imageUrl = "' + IMAGE_URL + '";\n'
  + 'const caption = "Hola, soy Jonathan \\ud83d\\udc4b" + "\\n" + "\\n" + "El d\\u00eda viernes 27 estaremos cocinando esto" + "\\n" + "\\n" + "\\ud83d\\udcb0 $8.00" + "\\n" + "\\ud83d\\udef5 Delivery GRATIS" + "\\n" + "\\n" + "\\u00bfCu\\u00e1ntos te aparto? Responde con la cantidad \\ud83d\\ude09";\n'
  + 'return [{ json: { imageUrl, caption } }];';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {
    if (node.name === 'Generar Cadena') {
      node.parameters.jsCode = jsCode;

      // Verify it's valid JS
      try {
        new Function(jsCode);
        console.log('✅ Código válido!');
      } catch(e) {
        console.log('❌ Código inválido:', e.message);
      }

      console.log('CODE:', JSON.stringify(jsCode).substring(0, 300));
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
