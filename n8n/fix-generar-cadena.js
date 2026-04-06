const API = 'https://n8n.solucionesomicron.com/api/v1/workflows/2EZ0PqE6jOX9NHwo';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const IMAGE_URL = 'https://raw.githubusercontent.com/banshyapp-maker/lola-whatsapp-bot/main/n8n/imagen-cadena.jpeg';

async function main() {
  const r = await fetch(API, { headers: { 'X-N8N-API-KEY': KEY } });
  const wf = await r.json();

  for (const node of wf.nodes) {
    if (node.name === 'Generar Cadena') {
      // Use template literal to avoid newline issues
      const code = [
        'const imageUrl = "' + IMAGE_URL + '";',
        'const caption = "\\ud83d\\udd25 *Hola! Soy Lola de El Istmo* \\ud83d\\udd25\\n\\nMira lo que cocinamos HOY para ti!\\n\\n\\ud83d\\udcb0 Solo $8.00\\n\\ud83d\\udef5 Delivery GRATIS\\n\\n\\ud83d\\udc47 Responde con la *cantidad* que quieres pedir y te atiendo! \\ud83d\\ude0a";',
        'return [{ json: { imageUrl, caption } }];'
      ].join('\n');
      node.parameters.jsCode = code;
      console.log('✅ Generar Cadena fixed');
      console.log('New code:', code);
    }
  }

  const saveResp = await fetch(API, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings })
  });
  const result = await saveResp.json();
  console.log(result.id ? '🚀 Saved!' : 'Error: ' + JSON.stringify(result).substring(0, 200));
}
main();
