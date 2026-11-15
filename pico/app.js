'use strict';
/* Pico — chat shell. The brain lives in bigbrain.js: Qwen2.5-0.5B-Instruct
   (free open-source weights) running 100% on-device via Transformers.js.
   Downloaded once, then fully offline. This file is UI only. */

const $ = (id) => document.getElementById(id);
const BOY = 'Pico';
let generating = false;
let brainReady = false;

function scrollToBottom() {
  const m = $('messages');
  requestAnimationFrame(() => { m.scrollTop = m.scrollHeight; });
}

function addUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'row user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble user-bubble';
  bubble.textContent = text;
  row.append(bubble);
  $('messages').append(row);
  scrollToBottom();
}

function addBoyBubble() {
  const row = document.createElement('div');
  row.className = 'row boy';
  const avatar = document.createElement('img');
  avatar.className = 'mini-avatar';
  avatar.src = './icon-192.png';
  avatar.alt = BOY;
  const bubble = document.createElement('div');
  bubble.className = 'bubble boy-bubble';
  bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  row.append(avatar, bubble);
  $('messages').append(row);
  scrollToBottom();
  return bubble;
}

function setPresence(text, online) {
  $('presence').textContent = text;
  $('dot').classList.toggle('online', !!online);
}

function setReadyUI() {
  brainReady = true;
  window.__chotuReady = true;
  $('bigCard').hidden = true;
  $('input').disabled = false;
  $('send').disabled = false;
  $('input').placeholder = 'Message Pico…';
  setPresence('Online · on this phone · remembers the chat', true);
}

async function wakeBrain() {
  setPresence('Waking up…', false);
  try {
    await window.PicoBig.load();
    setReadyUI();
  } catch (e) {
    console.error(e);
    setPresence('Brain failed to load — check connection and reopen', false);
    $('bigCard').hidden = false;
  }
}

async function ask(text) {
  if (generating) return;
  if (!brainReady) {
    $('bigCard').hidden = false;
    $('bigCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  generating = true;
  $('send').disabled = true;
  addUserBubble(text);
  const bubble = addBoyBubble();
  const started = performance.now();
  try {
    const ans = await window.PicoBig.ask(text, bubble, (partial) => {
      bubble.textContent = partial;
      scrollToBottom();
    });
    bubble.textContent = ans && ans.trim() ? ans.trim() : 'Hmm… I blinked on that one. Ask me again?';
  } catch (e) {
    console.error(e);
    bubble.textContent = 'Oops — my brain hit a snag. Give me a second and ask again?';
  }
  window.__chotuLastRun = { seconds: (performance.now() - started) / 1000, text: bubble.textContent };
  generating = false;
  $('send').disabled = false;
  scrollToBottom();
}

document.addEventListener('DOMContentLoaded', () => {
  const input = $('input');
  const sendCurrent = () => {
    const text = input.value.trim();
    if (!text || generating) return;
    input.value = '';
    input.style.height = 'auto';
    ask(text);
  };
  $('composer').addEventListener('submit', (e) => { e.preventDefault(); sendCurrent(); });
  // Direct tap handler as well: on phones, a form submit triggered by tapping
  // the button while the keyboard is open can be swallowed when the layout
  // shifts mid-tap. sendCurrent() clears the box, so a double fire is a no-op.
  $('send').addEventListener('click', (e) => { e.preventDefault(); sendCurrent(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCurrent(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { if (!generating) ask(chip.textContent.trim()); });
  });
  $('bigDownload').addEventListener('click', async () => {
    $('bigDownload').hidden = true;
    $('bigProgress').hidden = false;
    setPresence('Downloading my brain…', false);
    try {
      await window.PicoBig.load((pct, file) => {
        $('bigBar').value = pct;
        $('bigStatus').textContent = 'Downloading ' + file + ' — ' + pct + '%';
      });
      $('bigStatus').textContent = 'Brain installed! Ask me anything 🧠';
      setTimeout(setReadyUI, 800);
    } catch (e) {
      console.error(e);
      $('bigStatus').textContent = 'Download hiccup — tap retry. If it repeats, check Wi-Fi and storage space.';
      $('bigDownload').hidden = false;
      $('bigDownload').textContent = 'Retry download';
      setPresence('Download paused', false);
    }
  });

  window.__chotuAsk = ask;
  window.__chotuReady = false;

  if (window.PicoBig.wasDownloaded()) {
    wakeBrain();
  } else {
    $('bigCard').hidden = false;
    input.placeholder = 'Download my brain first 🧠';
    setPresence('Brain not downloaded yet', false);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW registration failed', err));
  }
});
