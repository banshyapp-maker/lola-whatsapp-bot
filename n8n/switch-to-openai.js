const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const WF_ID = '2EZ0PqE6jOX9NHwo';
const OPENAI_CRED_ID = 'Rg3uajuLBViWJXpv';
const WHATSAPP_CRED_ID = 'aynBnx2PMAwRJ7ya';
const ANTHROPIC_CRED_ID = 'QgassfKnwcBfuDFW';

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://n8n.solucionesomicron.com/api/v1' + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json' }
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
  const wf = await apiCall('GET', '/workflows/' + WF_ID);
  console.log('Got workflow with', wf.nodes.length, 'nodes');

  // === 1. Change Groq Whisper to OpenAI Whisper ===
  const groqNode = wf.nodes.find(n => n.name === 'Groq Whisper');
  groqNode.name = 'OpenAI Whisper';
  groqNode.parameters = {
    method: 'POST',
    url: 'https://api.openai.com/v1/audio/transcriptions',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    contentType: 'multipart-form-data',
    sendBody: true,
    bodyParameters: {
      parameters: [
        { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' },
        { parameterType: 'formData', name: 'model', value: 'whisper-1' },
        { parameterType: 'formData', name: 'language', value: 'es' }
      ]
    },
    options: {}
  };
  groqNode.credentials = {
    httpHeaderAuth: { id: OPENAI_CRED_ID, name: 'OpenAI API Key' }
  };
  console.log('1. Groq Whisper -> OpenAI Whisper');

  // === 2. Change ElevenLabs TTS to OpenAI TTS ===
  const ttsNode = wf.nodes.find(n => n.name === 'ElevenLabs TTS');
  ttsNode.name = 'OpenAI TTS';
  ttsNode.parameters = {
    method: 'POST',
    url: 'https://api.openai.com/v1/audio/speech',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendBody: true,
    specifyBody: 'json',
    jsonBody: `={{ JSON.stringify({ model: 'tts-1', input: $json.responseText, voice: 'nova', response_format: 'mp3' }) }}`,
    options: {
      response: {
        response: {
          responseFormat: 'file'
        }
      }
    }
  };
  ttsNode.credentials = {
    httpHeaderAuth: { id: OPENAI_CRED_ID, name: 'OpenAI API Key' }
  };
  console.log('2. ElevenLabs TTS -> OpenAI TTS (voice: nova)');

  // === 3. Fix connections for renamed nodes ===
  const conn = wf.connections;

  // Rename Groq Whisper connections
  if (conn['Groq Whisper']) {
    conn['OpenAI Whisper'] = conn['Groq Whisper'];
    delete conn['Groq Whisper'];
  }

  // Fix Descargar Audio -> OpenAI Whisper
  if (conn['Descargar Audio']) {
    conn['Descargar Audio'].main[0].forEach(c => {
      if (c.node === 'Groq Whisper') c.node = 'OpenAI Whisper';
    });
  }

  // Rename ElevenLabs TTS connections
  if (conn['ElevenLabs TTS']) {
    conn['OpenAI TTS'] = conn['ElevenLabs TTS'];
    delete conn['ElevenLabs TTS'];
  }

  // Fix Es Respuesta Audio? -> OpenAI TTS
  if (conn['Es Respuesta Audio?']) {
    conn['Es Respuesta Audio?'].main[0].forEach(c => {
      if (c.node === 'ElevenLabs TTS') c.node = 'OpenAI TTS';
    });
  }

  console.log('3. Connections fixed');

  // === 4. Update workflow ===
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: conn,
    settings: wf.settings,
    staticData: wf.staticData
  };

  const result = await apiCall('PUT', '/workflows/' + WF_ID, payload);

  if (result.id) {
    console.log('\nWorkflow updated! Active:', result.active);
    console.log('Total nodes:', result.nodes.length);

    // Verify changes
    const whisper = result.nodes.find(n => n.name === 'OpenAI Whisper');
    const tts = result.nodes.find(n => n.name === 'OpenAI TTS');
    console.log('\nOpenAI Whisper:', whisper ? 'OK - ' + whisper.parameters.url : 'MISSING');
    console.log('OpenAI TTS:', tts ? 'OK - ' + tts.parameters.url : 'MISSING');

    // Verify no more Groq/ElevenLabs references
    const oldNodes = result.nodes.filter(n => n.name.includes('Groq') || n.name.includes('ElevenLabs'));
    console.log('Old nodes remaining:', oldNodes.length === 0 ? 'NONE (clean)' : oldNodes.map(n => n.name).join(', '));
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(e => console.error(e));
