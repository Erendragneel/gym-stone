(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const gameUrl = document.querySelector('meta[name="gym-stone-share-url"]').content;
  let installPrompt = null, installed = false;
  const standalone = () => installed || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const appleMobile = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  function syncInstall() {
    const ready = standalone();
    $('download-app').textContent = ready ? '✓ App installed' : '↓ Download App';
    $('download-app').disabled = ready;
    $('install-now').hidden = ready || !installPrompt;
    $('install-status').textContent = ready ? 'Gym Stone is installed. Open it from your home screen or app launcher.' : '';
  }
  function openInstall() {
    syncInstall();
    $('install-description').textContent = 'Keep Gym Stone on your home screen with your new game icon. It opens as its own app window.';
    const steps = appleMobile() ? [
      'Open the official game link in Safari.',
      'Tap Share, then Add to Home Screen (under More if needed).',
      'Turn on Open as Web App if shown, then tap Add.'
    ] : /android/i.test(navigator.userAgent) ? [
      'Open the official game link in Chrome, Edge, or Samsung Internet.',
      'Open the browser menu and choose Install app or Add to Home screen.',
      'Confirm, then launch Gym Stone from your home screen.'
    ] : [
      'Open the official game link in Chrome or Edge.',
      'Click the install icon in the address bar, or choose Install Gym Stone from the browser menu.',
      'Confirm, then launch Gym Stone from your app launcher.'
    ];
    $('install-steps').replaceChildren(...steps.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    $('install-guidance').hidden = !!installPrompt || standalone();
    $('install-dialog').showModal();
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); installPrompt = event; syncInstall();
    $('install-guidance').hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installed = true; installPrompt = null; syncInstall();
    $('install-guidance').hidden = true;
  });
  matchMedia('(display-mode: standalone)').addEventListener('change', syncInstall);
  $('download-app').onclick = openInstall;
  $('install-now').onclick = async () => {
    const prompt = installPrompt;
    if (!prompt) return openInstall();
    $('install-now').disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      installPrompt = null; syncInstall();
      if (!standalone()) {
        $('install-status').textContent = choice.outcome === 'accepted' ? 'Installation requested. Your browser will finish adding Gym Stone.' : 'Installation dismissed. You can install later from your browser menu.';
        $('install-guidance').hidden = false;
      }
    } catch {
      installPrompt = null; syncInstall(); $('install-guidance').hidden = false;
      $('install-status').textContent = 'The browser could not open installation. Follow the steps below.';
    } finally { $('install-now').disabled = false; }
  };
  $('official-game-link').href = gameUrl;
  $('share-url').value = gameUrl;
  const status = message => { $('share-status').textContent = message; };
  async function copyLink() {
    try { await navigator.clipboard.writeText(gameUrl); status('Game link copied.'); return; } catch {}
    const input = $('share-url'); input.focus(); input.select();
    try { if (document.execCommand('copy')) { status('Game link copied.'); return; } } catch {}
    status('Select the game link and copy it using your device’s copy command.');
  }
  $('share-game').onclick = () => {
    status(''); $('share-dialog').showModal();
    try { GymStoneQR.draw($('share-qr'), gameUrl, {size: 280}); }
    catch { $('share-qr').hidden = true; $('download-qr').disabled = true; status('The QR code could not be created. You can still share the link.'); }
  };
  $('copy-share-link').onclick = copyLink;
  $('native-share').onclick = async () => {
    if (!navigator.share) return copyLink();
    try { await navigator.share({title: 'Gym Stone · Workout Quest', text: 'Plan workouts, track your streak, and build your training quest.', url: gameUrl}); status('Game link shared.'); }
    catch (error) { if (error.name === 'AbortError') status('Sharing cancelled.'); else await copyLink(); }
  };
  $('download-qr').onclick = () => {
    const link = document.createElement('a'); link.download = 'gym-stone-qr.png'; link.href = $('share-qr').toDataURL('image/png'); link.click();
    status('QR image download started.');
  };
  for (const id of ['share-dialog', 'install-dialog']) {
    const dialog = $(id);
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  }
  syncInstall();
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        $('offline-note').textContent = 'Offline setup could not finish. Open the official website online to try again.';
      });
    });
  }
})();
