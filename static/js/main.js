// Players for the demo tables. Without JavaScript the native controls remain.
(() => {
  'use strict';
  const ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.5v11l9-5.5z"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z"/></svg>',
    expand: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
  };
  const media = Array.from(document.querySelectorAll('.demo-table audio, .demo-table video'));
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fmt = t => {
    if (!isFinite(t)) return '0:00';
    const s = Math.floor(t);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // One sample at a time: starting a player pauses every other one.
  media.forEach(item => {
    item.addEventListener('play', () => {
      media.forEach(other => { if (other !== item) other.pause(); });
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) media.forEach(item => item.pause());
  });

  // A playhead on the mel spectrogram of the same column.
  const attachPlayhead = item => {
    const cell = item.closest('td');
    const table = item.closest('table');
    const row = table && table.tBodies.length
      ? Array.from(table.tBodies[0].rows).find(r => r.querySelector('td.mel')) : null;
    const target = row && cell ? row.cells[cell.cellIndex] : null;
    const img = target ? target.querySelector('img') : null;
    if (!img) return () => {};
    const head = document.createElement('span');
    head.className = 'playhead';
    head.hidden = true;
    target.classList.add('has-playhead');
    target.append(head);
    let frame = 0;
    const draw = () => {
      const d = item.duration;
      if (isFinite(d) && d > 0) {
        head.style.left = `${img.offsetLeft + img.offsetWidth * Math.min(1, item.currentTime / d)}px`;
        head.style.top = `${img.offsetTop}px`;
        head.style.height = `${img.offsetHeight}px`;
      }
    };
    const loop = () => { draw(); frame = item.paused ? 0 : requestAnimationFrame(loop); };
    item.addEventListener('play', () => { head.hidden = false; cancelAnimationFrame(frame); loop(); });
    item.addEventListener('seeked', () => { head.hidden = false; draw(); });
    item.addEventListener('timeupdate', () => { if (item.paused) draw(); });
    item.addEventListener('ended', () => { head.hidden = true; });
    return () => { head.hidden = false; draw(); };
  };

  // The same compact control for audio and video: play/pause, seek bar, time.
  media.forEach(item => {
    const isVideo = item.tagName === 'VIDEO';
    const label = (item.getAttribute('aria-label') || 'sample').replace(/^Play /, '');
    const player = document.createElement('div');
    player.className = 'player';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'player-toggle';
    toggle.innerHTML = ICON.play;
    toggle.setAttribute('aria-label', `Play ${label}`);
    const bar = document.createElement('div');
    bar.className = 'player-bar';
    bar.setAttribute('role', 'slider');
    bar.setAttribute('aria-label', `Seek ${label}`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuenow', '0');
    bar.tabIndex = 0;
    const fill = document.createElement('div');
    fill.className = 'player-fill';
    bar.append(fill);
    const time = document.createElement('span');
    time.className = 'player-time';
    time.textContent = '0:00';
    player.append(toggle, bar, time);

    const toggleplay = () => {
      if (!item.paused) { item.pause(); return; }
      const started = item.play();
      if (started && started.catch) started.catch(() => {});
    };
    let frameBox = null;
    if (isVideo) {
      frameBox = document.createElement('div');
      frameBox.className = 'video-frame';
      item.before(frameBox);
      frameBox.append(item);
      const glyph = document.createElement('span');
      glyph.className = 'video-glyph';
      glyph.innerHTML = ICON.play;
      frameBox.append(glyph);
      frameBox.after(player);
      frameBox.addEventListener('click', () => { if (fullscreenElement() !== item) toggleplay(); });
      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'player-expand';
      expand.innerHTML = ICON.expand;
      expand.setAttribute('aria-label', `Full screen: ${label}`);
      expand.addEventListener('click', () => {
        const enter = item.requestFullscreen || item.webkitRequestFullscreen || item.webkitEnterFullscreen;
        if (enter) enter.call(item);
      });
      player.append(expand);
    } else {
      item.after(player);
    }
    item.controls = false;

    const showHead = attachPlayhead(item);
    const update = () => {
      const d = item.duration;
      const r = isFinite(d) && d > 0 ? item.currentTime / d : 0;
      fill.style.width = `${100 * r}%`;
      time.textContent = fmt(item.currentTime);
      bar.setAttribute('aria-valuemax', isFinite(d) ? d.toFixed(1) : '0');
      bar.setAttribute('aria-valuenow', item.currentTime.toFixed(1));
    };
    const seekTo = ratio => {
      const apply = () => { item.currentTime = Math.max(0, Math.min(1, ratio)) * item.duration; update(); showHead(); };
      if (isFinite(item.duration)) apply();
      else { item.preload = 'metadata'; item.addEventListener('loadedmetadata', apply, { once: true }); item.load(); }
    };
    const setPlaying = on => {
      toggle.innerHTML = on ? ICON.pause : ICON.play;
      toggle.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${label}`);
      player.classList.toggle('playing', on);
      if (frameBox) frameBox.classList.toggle('is-playing', on);
      if (!on) player.classList.remove('loading');
    };
    toggle.addEventListener('click', toggleplay);
    item.addEventListener('play', () => { setPlaying(true); player.classList.add('loading'); });
    item.addEventListener('playing', () => player.classList.remove('loading'));
    item.addEventListener('waiting', () => player.classList.add('loading'));
    item.addEventListener('pause', () => setPlaying(false));
    item.addEventListener('error', () => setPlaying(false));
    item.addEventListener('timeupdate', update);
    item.addEventListener('loadedmetadata', update);
    bar.addEventListener('click', event => {
      const box = bar.getBoundingClientRect();
      seekTo((event.clientX - box.left) / box.width);
    });
    bar.addEventListener('keydown', event => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step || !isFinite(item.duration)) return;
      event.preventDefault();
      seekTo((item.currentTime + step) / item.duration);
    });
  });

  // A video shown full screen gets the browser's own controls.
  const syncFullscreen = () => {
    const current = fullscreenElement();
    media.forEach(item => { if (item.tagName === 'VIDEO') item.controls = item === current; });
  };
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
})();

// Click a mel spectrogram to view it enlarged; click again or press Escape to close.
(() => {
  'use strict';
  const overlay = document.createElement('div');
  overlay.className = 'mel-zoom';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;
  const image = document.createElement('img');
  image.alt = '';
  const caption = document.createElement('p');
  overlay.append(image, caption);
  document.body.append(overlay);

  let opener = null;
  const close = () => {
    overlay.hidden = true;
    image.removeAttribute('src');
    if (opener) opener.focus();
  };
  const open = img => {
    const cell = img.closest('td');
    const table = img.closest('table');
    const header = table && table.tHead ? table.tHead.rows[0].cells[cell.cellIndex] : null;
    opener = img;
    image.src = img.currentSrc || img.src;
    image.alt = img.alt;
    caption.textContent = header ? header.textContent.trim() : img.alt;
    overlay.setAttribute('aria-label', img.alt);
    overlay.hidden = false;
    overlay.focus();
  };

  document.querySelectorAll('.demo-table td.mel img').forEach(img => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.addEventListener('click', () => open(img));
    img.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(img); }
    });
  });
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) close();
  });
})();

// Section bar: shown once the title block has scrolled away; marks the section in view.
(() => {
  'use strict';
  const bar = document.getElementById('topbar');
  const sentinel = document.querySelector('.actions');
  if (!bar || !sentinel || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([entry]) => {
    bar.classList.toggle('is-visible', !entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(sentinel);

  const strip = bar.querySelector('.topbar-links');
  const links = new Map(Array.from(strip.querySelectorAll('a'), a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const active = links.get(entry.target.id);
      links.forEach(a => { if (a !== active) a.removeAttribute('aria-current'); });
      active.setAttribute('aria-current', 'true');
      strip.scrollTo({ left: active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2 });
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) spy.observe(section);
  });
})();
