const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmZDY4ZGY4Ny0yOWI0LTQ1NDUtOTk1MC05ZmNkMTU0ZGZjNmQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzc0OTI3NjM4fQ.-frsaFzAx3XDN78N52AACcE-7pwuLR-PzcN07vw3FkE';
const WF_ID = '2EZ0PqE6jOX9NHwo';
const ELEVENLABS_CRED_ID = 'yPptJvfUQxFB9yED';
const WHATSAPP_CRED_ID = 'aynBnx2PMAwRJ7ya';

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

  // --- Step 1: Modify "Texto del Audio" to flag isAudio ---
  const textoDelAudio = wf.nodes.find(n => n.name === 'Texto del Audio');
  textoDelAudio.parameters.jsCode = `const transcription = $input.first().json.text || '[No se pudo transcribir el audio]';
const phoneNumber = $('Extraer Datos').first().json.phoneNumber;

return [{
  json: {
    phoneNumber,
    messageContent: '[El cliente envio un audio que dice]: ' + transcription,
    isAudio: true
  }
}];`;

  // --- Step 2: Modify "Preparar Texto" to flag isAudio = false ---
  const prepararTexto = wf.nodes.find(n => n.name === 'Preparar Texto');
  prepararTexto.parameters.jsCode = `const item = $('Extraer Datos').first().json;

return [{
  json: {
    phoneNumber: item.phoneNumber,
    messageContent: item.messageContent,
    isAudio: false
  }
}];`;

  // --- Step 3: Modify "Texto de Imagen" to flag isAudio = false ---
  const textoDeImagen = wf.nodes.find(n => n.name === 'Texto de Imagen');
  textoDeImagen.parameters.jsCode = `const phoneNumber = $('Extraer Datos').first().json.phoneNumber;
const caption = $('Extraer Datos').first().json.imageCaption;

let messageContent = '[El cliente envio una imagen';
if (caption) {
  messageContent += ' con el texto: ' + caption;
}
messageContent += ']. Responde de forma amigable. Si parece ser de comida o del restaurante, comenta al respecto. Si no entiendes el contexto, pregunta amablemente en que puedes ayudar.';

return [{
  json: {
    phoneNumber,
    messageContent,
    isAudio: false
  }
}];`;

  // --- Step 4: Modify "Procesar Respuesta" to pass isAudio flag ---
  const procesarResp = wf.nodes.find(n => n.name === 'Procesar Respuesta');
  procesarResp.parameters.jsCode = `const response = $input.first().json;
let text = '';

try {
  text = response.content[0].text;
} catch (e) {
  text = 'Ay, disculpa! Tuve un problemita tecnico. Intenta de nuevo en un momentito.';
}

const needsEscalation = text.includes('[ESCALAR_A_HUMANO]');
if (needsEscalation) {
  text = text.replace('[ESCALAR_A_HUMANO]', '').trim();
}

const phoneNumber = $('Extraer Datos').first().json.phoneNumber;

// Check if original message was audio - try to get isAudio flag
let isAudio = false;
try {
  // Try from Texto del Audio (audio path)
  isAudio = $('Texto del Audio').first().json.isAudio === true;
} catch(e) {
  try {
    isAudio = $('Preparar Texto').first().json.isAudio === true;
  } catch(e2) {
    try {
      isAudio = $('Texto de Imagen').first().json.isAudio === true;
    } catch(e3) {
      isAudio = false;
    }
  }
}

if (text.length > 4000) {
  text = text.substring(0, 4000) + '...';
}

return [{
  json: {
    phoneNumber,
    responseText: text,
    needsEscalation,
    isAudio
  }
}];`;

  // --- Step 5: Add new nodes for TTS ---

  // Node: Check if audio response needed
  const checkAudioNode = {
    parameters: {
      jsCode: `const item = $input.first().json;
if (item.isAudio) {
  return [{ json: item }];
}
return [];`
    },
    id: 'tts-check-audio',
    name: 'Es Respuesta Audio?',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2900, 100]
  };

  // Node: Check if text response (not audio)
  const checkTextNode = {
    parameters: {
      jsCode: `const item = $input.first().json;
if (!item.isAudio) {
  return [{ json: item }];
}
return [];`
    },
    id: 'tts-check-text',
    name: 'Es Respuesta Texto?',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2900, 500]
  };

  // Node: ElevenLabs TTS
  const ttsNode = {
    parameters: {
      method: 'POST',
      url: 'https://api.elevenlabs.io/v1/text-to-speech/cgSgspJ2msm6clMCkdW9',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({ text: $json.responseText, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }) }}`,
      options: {
        response: {
          response: {
            responseFormat: 'file'
          }
        }
      }
    },
    id: 'tts-elevenlabs',
    name: 'ElevenLabs TTS',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3160, 100],
    credentials: {
      httpHeaderAuth: {
        id: ELEVENLABS_CRED_ID,
        name: 'ElevenLabs API Key'
      }
    }
  };

  // Node: Upload audio to WhatsApp Media
  const uploadMediaNode = {
    parameters: {
      method: 'POST',
      url: 'https://graph.facebook.com/v21.0/1103393509513315/media',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      contentType: 'multipart-form-data',
      sendBody: true,
      bodyParameters: {
        parameters: [
          {
            parameterType: 'formBinaryData',
            name: 'file',
            inputDataFieldName: 'data'
          },
          {
            parameterType: 'formData',
            name: 'messaging_product',
            value: 'whatsapp'
          },
          {
            parameterType: 'formData',
            name: 'type',
            value: 'audio/mpeg'
          }
        ]
      },
      options: {}
    },
    id: 'upload-media',
    name: 'Subir Audio a WhatsApp',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3420, 100],
    credentials: {
      httpHeaderAuth: {
        id: WHATSAPP_CRED_ID,
        name: 'WhatsApp Token'
      }
    }
  };

  // Node: Send audio message via WhatsApp
  const sendAudioNode = {
    parameters: {
      method: 'POST',
      url: 'https://graph.facebook.com/v21.0/1103393509513315/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ JSON.stringify({ messaging_product: 'whatsapp', to: $('Procesar Respuesta').first().json.phoneNumber, type: 'audio', audio: { id: $json.id } }) }}`,
      options: {}
    },
    id: 'send-audio-wa',
    name: 'Enviar Audio WhatsApp',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [3680, 100],
    credentials: {
      httpHeaderAuth: {
        id: WHATSAPP_CRED_ID,
        name: 'WhatsApp Token'
      }
    }
  };

  // Add new nodes
  wf.nodes.push(checkAudioNode, checkTextNode, ttsNode, uploadMediaNode, sendAudioNode);

  // --- Step 6: Fix connections ---
  const conn = wf.connections;

  // Procesar Respuesta -> split to audio check and text check (instead of direct to Enviar WhatsApp)
  conn['Procesar Respuesta'] = {
    main: [[
      { node: 'Es Respuesta Audio?', type: 'main', index: 0 },
      { node: 'Es Respuesta Texto?', type: 'main', index: 0 }
    ]]
  };

  // Text path: Es Respuesta Texto? -> Enviar WhatsApp (existing text send)
  conn['Es Respuesta Texto?'] = {
    main: [[{ node: 'Enviar WhatsApp', type: 'main', index: 0 }]]
  };

  // Audio path: Es Respuesta Audio? -> ElevenLabs TTS -> Upload -> Send Audio
  conn['Es Respuesta Audio?'] = {
    main: [[{ node: 'ElevenLabs TTS', type: 'main', index: 0 }]]
  };

  conn['ElevenLabs TTS'] = {
    main: [[{ node: 'Subir Audio a WhatsApp', type: 'main', index: 0 }]]
  };

  conn['Subir Audio a WhatsApp'] = {
    main: [[{ node: 'Enviar Audio WhatsApp', type: 'main', index: 0 }]]
  };

  // --- Step 7: Update workflow ---
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: conn,
    settings: wf.settings,
    staticData: wf.staticData
  };

  const result = await apiCall('PUT', '/workflows/' + WF_ID, payload);

  if (result.id) {
    console.log('Workflow updated! Nodes:', result.nodes.length);
    console.log('Active:', result.active);

    // Verify new nodes exist
    const newNodes = ['Es Respuesta Audio?', 'Es Respuesta Texto?', 'ElevenLabs TTS', 'Subir Audio a WhatsApp', 'Enviar Audio WhatsApp'];
    newNodes.forEach(name => {
      const found = result.nodes.find(n => n.name === name);
      console.log(found ? '  OK' : '  MISSING', name);
    });
  } else {
    console.log('Error:', JSON.stringify(result).substring(0, 500));
  }
}

main().catch(e => console.error(e));
