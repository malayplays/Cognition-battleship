// Visual effects: screen shake, confetti, attack animations, banners.
// No game logic here — purely cosmetic.

const Effects = (() => {
  // Screen shake
  function screenShake(intensity = 'medium') {
    const el = document.getElementById('game-screen');
    if (!el) return;
    el.classList.remove('screen-shake');
    void el.offsetWidth; // reflow
    el.classList.add('screen-shake');
    setTimeout(() => el.classList.remove('screen-shake'), 400);
  }

  // Confetti burst (for victory)
  function confetti(count = 40) {
    const colors = ['#FFD54F', '#FF5722', '#4CAF50', '#2196F3', '#E91E63', '#FF9800', '#9C27B0'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.cssText =
        'left:' + (Math.random() * 100) + 'vw;' +
        'top:-10px;' +
        'background:' + colors[i % colors.length] + ';' +
        'animation-delay:' + (Math.random() * 1.5) + 's;' +
        'animation-duration:' + (1.5 + Math.random() * 1.5) + 's;' +
        'width:' + (4 + Math.random() * 8) + 'px;' +
        'height:' + (4 + Math.random() * 8) + 'px;';
      el.addEventListener('animationend', () => el.remove(), { once: true });
      frag.appendChild(el);
    }
    document.body.appendChild(frag);
  }

  // Create spark particles on a cell
  function sparks(cellEl, count = 6) {
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const frag = document.createDocumentFragment();

    const sparksArr = [];
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      spark.className = 'confetti';
      const angle = (Math.PI * 2 * i) / count;
      const dist = 20 + Math.random() * 30;
      spark.style.cssText =
        'left:' + cx + 'px;top:' + cy + 'px;width:4px;height:4px;' +
        'background:' + (i % 2 === 0 ? '#FF5722' : '#FFD54F') + ';' +
        'position:fixed;z-index:200;pointer-events:none;' +
        'animation:spark-fly 0.6s ease-out forwards;' +
        '--sx:' + (Math.cos(angle) * dist) + 'px;' +
        '--sy:' + (Math.sin(angle) * dist) + 'px;';
      frag.appendChild(spark);
      sparksArr.push(spark);
    }
    document.body.appendChild(frag);
    setTimeout(() => { for (const s of sparksArr) s.remove(); }, 700);
  }

  // Show banner (e.g. "SHIP SUNK!")
  function showBanner(text, duration = 1800) {
    const overlay = document.getElementById('banner-overlay');
    const textEl = document.getElementById('banner-text');
    if (!overlay || !textEl) return;
    textEl.textContent = text;
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, duration);
  }

  // Set background phase
  function setBgPhase(phase) {
    const bg = document.getElementById('ocean-bg');
    if (!bg) return;
    bg.className = 'ocean-bg phase-' + phase;
  }

  // Attack result flash text
  function showAttackResult(text, type) {
    const overlay = document.getElementById('attack-overlay');
    if (!overlay) return;
    const resultText = overlay.querySelector('.attack-result-text');
    resultText.textContent = text;
    resultText.style.color = type === 'hit' ? '#FF5722' : type === 'sunk' ? '#D32F2F' : '#B0BEC5';

    overlay.classList.remove('hidden');
    overlay.classList.add('anim-active');
    setTimeout(() => {
      overlay.classList.remove('anim-active');
      overlay.classList.add('hidden');
    }, 1200);
  }

  // Ripple effect on water cell when placing ship
  function placeRipple(cellEl) {
    if (!cellEl) return;
    const ripple = document.createElement('div');
    ripple.style.cssText = `
      position: absolute; inset: -4px;
      border: 2px solid rgba(84,110,122,0.6);
      border-radius: 50%;
      animation: ripple-expand 0.5s ease-out forwards;
      pointer-events: none;
      z-index: 10;
    `;
    cellEl.style.position = 'relative';
    cellEl.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  return {
    screenShake,
    confetti,
    sparks,
    showBanner,
    setBgPhase,
    showAttackResult,
    placeRipple,
  };
})();
