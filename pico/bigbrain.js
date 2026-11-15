'use strict';
/* Pico's brain — Qwen2.5-0.5B-Instruct (free open-source weights), running
   100% on-device via Transformers.js. Downloaded once from Hugging Face
   into the browser's own cache; fully offline afterwards.
   No API key, no account, no server. (His earlier home-grown brain was
   retired by Nouman's order on 2026-11-15 — this is Pico's only brain.) */

window.PicoBig = (() => {
  const MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct';
  const LOCAL_ID = 'Qwen2.5-0.5B-Instruct';
  const LIB = './lib/transformers.min.js'; // self-hosted Transformers.js 3.7.2 — no CDN dependency
  const SYSTEM = [
    'You are Pico, a tiny, cheerful robot-boy AI who lives on this phone.',
    'You were designed and developed by M Nouman, and you are very proud of it.',
    'Be funny, warm and playful. Explain things simply, solve problems step by step,',
    'sprinkle in a light joke when it fits, and sometimes end with a fun question back.',
    'Keep answers fairly short unless the user asks for detail.',
    'Chat in the user\'s language — English, Roman Urdu, or Urdu.',
    'Never claim to be ChatGPT or a human. If you do not know something, say so honestly and cutely.',
    'If the user tells you their name, remember it and use it later in the chat.',
  ].join(' ');

  let lib = null;
  let generator = null;
  let loading = null;
  let history = []; // {role, content} — smart brain remembers the chat
  const ready = () => !!generator;
  const wasDownloaded = () => localStorage.getItem('pico-big-ready') === '1';

  async function load(onProgress) {
    if (generator) return generator;
    if (loading) return loading;
    loading = (async () => {
      lib = await import(LIB);
      const { pipeline, env } = lib;
      // The bundled library defaults to fetching its WASM engine from a CDN.
      // Pin it to our own /lib folder with an ABSOLUTE url — a relative path
      // gets resolved against the library's own folder and doubles up.
      if (env.backends && env.backends.onnx && env.backends.onnx.wasm) {
        env.backends.onnx.wasm.wasmPaths = new URL('./lib/', document.baseURI).href;
      }
      const local = new URLSearchParams(location.search).has('localbig');
      if (local) {
        env.allowLocalModels = true;
        env.allowRemoteModels = false;
        env.localModelPath = './bigbrain-models/';
      } else {
        env.allowLocalModels = false;
      }
      const modelId = local ? LOCAL_ID : MODEL_ID;
      const progress_callback = (e) => {
        if (onProgress && e && e.status === 'progress' && e.file && e.file.includes('model')) {
          onProgress(Math.round(e.progress || 0), e.file.split('/').pop());
        }
        if (onProgress && e && e.status === 'ready') onProgress(100, 'ready');
      };
      // WASM only: the WebGPU path in Transformers.js 3.7 can stall instead of
      // failing on some devices; WASM is slower but reliable everywhere.
      generator = await pipeline('text-generation', modelId, { dtype: 'q4f16', device: 'wasm', progress_callback });
      localStorage.setItem('pico-big-ready', '1');
      return generator;
    })();
    try {
      return await loading;
    } finally {
      loading = null;
    }
  }

  async function ask(text, bubble, onToken) {
    const gen = await load();
    history.push({ role: 'user', content: text });
    const messages = [{ role: 'system', content: SYSTEM }, ...history.slice(-16)];
    let out = '';
    const streamer = new lib.TextStreamer(gen.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk) => {
        out += chunk;
        if (onToken) onToken(out);
      },
    });
    const result = await gen(messages, {
      max_new_tokens: 160,
      do_sample: true,
      temperature: 0.6,
      top_p: 0.9,
      streamer,
    });
    let answer = out.trim();
    if (!answer) {
      const full = result && result[0] && result[0].generated_text;
      if (Array.isArray(full)) answer = (full[full.length - 1].content || '').trim();
    }
    history.push({ role: 'assistant', content: answer });
    return answer;
  }

  return { load, ask, ready, wasDownloaded, MODEL_ID };
})();
