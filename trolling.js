// trolling.js — drop this script tag into any page to enable troll effects
// Requires Firebase (app, database, auth) to already be initialised on the page.
// Usage: <script src="trolling.js"></script>  (after your firebase scripts)

(function() {
  // ── Inject required HTML elements if they don't exist ──
  function injectHTML() {
    if (document.getElementById('trolledOverlay')) return; // Already injected

    const html = `
      <div id="fake-cursor" style="position:fixed;width:20px;height:20px;font-size:20px;pointer-events:none;z-index:2147483647;display:none;">🖱️</div>

      <div id="trolledOverlay" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483640;backdrop-filter:none;-webkit-backdrop-filter:none;pointer-events:none;">
        <div id="trollMessageBox" style="pointer-events:auto;position:absolute;bottom:20px;left:20px;background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;border:1px solid #f04747;max-width:400px;box-shadow:0 0 20px #f04747;">
          <button id="minimizeTrollBtn" style="position:absolute;top:-10px;left:170px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;">&minus;</button>
          <h3 style="color:#f04747;margin-top:0;">You've been trolled! (Click - to minimise)</h3>
          <div id="troll-list-container" style="max-height:40vh;overflow-y:auto;padding-right:10px;"></div>
        </div>
      </div>

      <button id="minimizedTrollIndicator" style="display:none;position:fixed;bottom:20px;right:20px;z-index:2147483641;background:#f04747;color:white;border:1px solid #fff;border-radius:20px;padding:8px 15px;font-weight:bold;box-shadow:0 0 15px #f04747;cursor:pointer;">
        😈 You are Trolled
      </button>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);
  }

  // ── TROLL_CATALOG — fallback defaults, overwritten from Firebase config ──
  window.TROLL_CATALOG = window.TROLL_CATALOG || {
    'blur':         { name: 'Blur Screen (1 Hour)',      cost: 500,  duration: 3600000 },
    'invert':       { name: 'Invert Colors (1 Hour)',    cost: 300,  duration: 3600000 },
    'ban':          { name: 'Temporary Ban (30 Min)',     cost: 2000, duration: 1800000 },
    'cursor_dance': { name: 'Cursor Dance (2 Min)',       cost: 750,  duration: 120000  },
    'test':         { name: 'Test Troll (10 sec)',        cost: 10,   duration: 10000   },
  };

  // ── Core troll functions ──

  window.listenForTrolls = function(uid) {
    const db = firebase.database();
    const trollsRef = db.ref('users/' + uid + '/activeTrolls');
    trollsRef.on('value', snap => {
      const activeTrolls = snap.val() || {};
      const now = Date.now();
      const validTrolls = {};
      for (const key in activeTrolls) {
        if (activeTrolls[key].endsAt > now) {
          validTrolls[key] = activeTrolls[key];
        } else {
          trollsRef.child(key).remove();
        }
      }
      applyTrollEffects(validTrolls);
    });

    // Load troll catalog from Firebase
    db.ref('config/trollCatalog').once('value').then(snap => {
      if (snap.exists()) Object.assign(window.TROLL_CATALOG, snap.val());
    });
  };

  function applyTrollEffects(activeTrolls) {
    const overlay = document.getElementById('trolledOverlay');
    const messageBox = document.getElementById('trollMessageBox');
    const minimizedIndicator = document.getElementById('minimizedTrollIndicator');
    const trollListContainer = document.getElementById('troll-list-container');
    if (!overlay) return;

    removeTrollEffects();

    const trollEntries = Object.entries(activeTrolls);
    if (trollEntries.length === 0) return;

    // Apply visual effects
    let hasBlur = false, hasInvert = false, hasBan = false, hasCursorDance = false;
    trollEntries.forEach(([, troll]) => {
      if (troll.type === 'blur')         hasBlur = true;
      if (troll.type === 'invert')       hasInvert = true;
      if (troll.type === 'ban')          hasBan = true;
      if (troll.type === 'cursor_dance') hasCursorDance = true;
    });

    if (hasBlur) {
      overlay.style.backdropFilter = 'blur(5px)';
      overlay.style.webkitBackdropFilter = 'blur(5px)';
    }
    if (hasInvert) {
      document.documentElement.style.filter = 'invert(1)';
    }
    if (hasCursorDance) {
      const fakeCursor = document.getElementById('fake-cursor');
      if (fakeCursor) {
        fakeCursor.style.display = 'block';
        window.cursorDanceInterval = setInterval(() => {
          fakeCursor.style.left = Math.random() * (window.innerWidth - 20) + 'px';
          fakeCursor.style.top  = Math.random() * (window.innerHeight - 20) + 'px';
        }, 500);
      }
    }
    if (hasBan) {
      overlay.style.background = 'rgba(0,0,0,0.95)';
      overlay.style.pointerEvents = 'auto';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      messageBox.style.position = 'static';
      messageBox.style.textAlign = 'center';
    }

    overlay.style.display = 'block';
    messageBox.style.display = 'block';

    // Gamble button
    if (!document.getElementById('gambleSection')) {
      const gs = document.createElement('div');
      gs.id = 'gambleSection';
      gs.style.cssText = 'border-top:1px solid #555;margin-top:15px;padding-top:15px;';
      gs.innerHTML = `
        <h4 style="margin-top:0;color:#ffc107;">Feeling Lucky?</h4>
        <p style="font-size:0.9rem;">Gamble your points for a chance to win big!</p>
        <button onclick="if(window.openGambleWheel)openGambleWheel()" class="btn btn-warning btn-sm">Open Gamble Wheel</button>`;
      messageBox.appendChild(gs);
    }

    minimizedIndicator.style.display = 'none';

    trollListContainer.innerHTML = trollEntries.map(([key, trollData]) => {
      const cost = (window.TROLL_CATALOG[trollData.type] || {}).cost || 0;
      const payOutCost = Math.floor(cost * 0.75);
      return `
        <div class="troll-instance" style="border-bottom:1px solid #444;padding-bottom:10px;margin-bottom:10px;">
          <h4 style="color:#f04747;margin-top:0;font-size:1rem;">${(window.TROLL_CATALOG[trollData.type] || {}).name || 'Unknown Troll'}</h4>
          <p style="margin:2px 0;font-size:0.9rem;">Trolled by: <strong>${trollData.trollerName}</strong></p>
          <p style="margin:2px 0;font-size:0.9rem;">Time remaining: <strong id="trollTimeLeft_${key}"></strong></p>
          <p style="margin:8px 0 4px;font-size:0.9rem;">Pay <strong>${payOutCost}💎</strong> to remove.</p>
          <button onclick="payOutOfSingleTroll('${key}')" class="btn btn-warning btn-xs" style="padding:1px 6px;font-size:0.7rem;min-height:20px;">Pay</button>
          <button onclick="trollBack('${trollData.trollerUid}','${trollData.trollerName}')" class="btn btn-danger btn-xs" style="margin-left:5px;padding:1px 6px;font-size:0.7rem;min-height:20px;">Troll Back</button>
        </div>`;
    }).join('');

    document.getElementById('minimizeTrollBtn').onclick = () => {
      messageBox.style.display = 'none';
      minimizedIndicator.style.display = 'block';
    };
    minimizedIndicator.onclick = () => {
      messageBox.style.display = 'block';
      minimizedIndicator.style.display = 'none';
    };

    // Countdown timers
    window.trollCountdowns = [];
    trollEntries.forEach(([key, trollData]) => {
      const interval = setInterval(() => {
        const remaining = trollData.endsAt - Date.now();
        const el = document.getElementById('trollTimeLeft_' + key);
        if (remaining > 0 && el) {
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          el.innerText = h + 'h ' + m + 'm ' + s + 's';
        }
      }, 1000);
      window.trollCountdowns.push(interval);
    });
  }

  function removeTrollEffects() {
    const overlay    = document.getElementById('trolledOverlay');
    const messageBox = document.getElementById('trollMessageBox');
    const indicator  = document.getElementById('minimizedTrollIndicator');
    const fakeCursor = document.getElementById('fake-cursor');
    const gs         = document.getElementById('gambleSection');

    if (gs) gs.remove();
    if (overlay) {
      overlay.style.display = 'none';
      overlay.style.backdropFilter = 'none';
      overlay.style.webkitBackdropFilter = 'none';
      overlay.style.background = 'none';
      overlay.style.pointerEvents = 'none';
      overlay.style.alignItems = 'initial';
      overlay.style.justifyContent = 'initial';
    }
    if (messageBox) {
      messageBox.style.position = 'absolute';
      messageBox.style.textAlign = 'left';
      messageBox.style.display = 'block';
    }
    if (indicator) indicator.style.display = 'none';
    if (fakeCursor) fakeCursor.style.display = 'none';
    document.documentElement.style.filter = 'none';
    if (window.cursorDanceInterval) clearInterval(window.cursorDanceInterval);
    if (window.trollCountdowns) { window.trollCountdowns.forEach(clearInterval); window.trollCountdowns = []; }
  }

  window.trollBack = function(trollerUid, trollerName) {
    // trollBack needs openTrollModal — only available on dashboard.html
    // On other pages, redirect to dashboard with the target pre-set
    if (typeof openTrollModal === 'function') {
      openTrollModal(trollerUid, trollerName, true);
    } else {
      localStorage.setItem('twc_trollback_uid', trollerUid);
      localStorage.setItem('twc_trollback_name', trollerName);
      window.location.href = 'dashboard.html';
    }
  };

  window.payOutOfSingleTroll = function(trollKey) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const userRef = firebase.database().ref('users/' + user.uid);
    userRef.child('activeTrolls/' + trollKey).once('value').then(trollSnap => {
      if (!trollSnap.exists()) return;
      const cost = (window.TROLL_CATALOG[trollSnap.val().type] || {}).cost || 0;
      const payOutCost = Math.floor(cost * 0.75);
      userRef.child('points').once('value').then(pointsSnap => {
        const pts = pointsSnap.val() || 0;
        if (pts < payOutCost) return alert("Not enough points!");
        if (confirm('Pay ' + payOutCost + ' points to remove this effect?')) {
          userRef.update({ points: pts - payOutCost, ['activeTrolls/' + trollKey]: null })
            .then(() => alert("Paid your way out!"));
        }
      });
    });
  };

  // ── Auto-init: inject HTML then start listening once Firebase auth resolves ──
  function init() {
    injectHTML();
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length) return;
    firebase.auth().onAuthStateChanged(user => {
      if (user) listenForTrolls(user.uid);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
