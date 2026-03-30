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
        <div id="trollMessageBox" style="pointer-events:auto;position:fixed;bottom:20px;left:20px;background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;border:1px solid #f04747;max-width:400px;width:calc(100vw - 60px);max-height:70vh;overflow-y:auto;box-sizing:border-box;box-shadow:0 0 20px #f04747;scrollbar-width:thin;scrollbar-color:#f04747 transparent;">
          <button id="minimizeTrollBtn" style="position:absolute;top:10px;right:10px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;">&minus;</button>
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

  var _uid         = null;
  var _db          = null;
  var _trollsRef   = null;
  var _tickTimer   = null;
  var _servedMs    = {};   // { trollKey: msServedTotal } — in-memory, synced to Firebase on hide
  var _activeTrolls = {};  // in-memory mirror of activeTrolls node
  var _tabVisible  = !document.hidden;

  function _servedRef(key) {
    return _db.ref('troll_served/' + _uid + '/' + key);
  }

  // Write all served times to Firebase — called on hide and beforeunload only
  function _flushServed() {
    if (!_uid || !_db) return;
    const updates = {};
    Object.keys(_servedMs).forEach(function(key) {
      updates['troll_served/' + _uid + '/' + key] = _servedMs[key];
    });
    if (Object.keys(updates).length) _db.ref().update(updates);
  }

  // Remove served record from Firebase when troll expires
  function _clearServed(key) {
    delete _servedMs[key];
    if (_uid && _db) _db.ref('troll_served/' + _uid + '/' + key).remove();
  }

  // Update countdown display for one troll key
  function _updateDisplay(key, remainingMs) {
    var el = document.getElementById('trollTimeLeft_' + key);
    if (!el) return;
    var rem = Math.max(0, remainingMs);
    var h = Math.floor(rem / 3600000);
    var m = Math.floor((rem % 3600000) / 60000);
    var s = Math.floor((rem % 60000) / 1000);
    el.innerText = h + 'h ' + m + 'm ' + s + 's';
  }

  // Tick every second — only counts time when tab is visible
  function _startTick() {
    if (_tickTimer) clearInterval(_tickTimer);
    _tickTimer = setInterval(function() {
      if (!_tabVisible) return;
      var anyExpired = false;
      Object.keys(_activeTrolls).forEach(function(key) {
        _servedMs[key] = (_servedMs[key] || 0) + 1000;
        var remaining = _activeTrolls[key].duration - _servedMs[key];
        _updateDisplay(key, remaining);
        if (remaining <= 0) {
          // Expired — remove from Firebase and served record
          _trollsRef.child(key).remove();
          _clearServed(key);
          anyExpired = true;
        }
      });
      if (anyExpired) {
        // Listener will re-fire and re-render
      }
    }, 1000);
  }

  window.listenForTrolls = function(uid) {
    _uid       = uid;
    _db        = firebase.database();
    _trollsRef = _db.ref('users/' + uid + '/activeTrolls');

    // ── Visibility: pause tick when hidden, flush served to Firebase ──
    function onVisibility() {
      _tabVisible = !document.hidden;
      if (!_tabVisible) _flushServed(); // write on hide
    }

    // ── beforeunload: flush served so next device/session picks it up ──
    function onUnload() { _flushServed(); }

    document.removeEventListener('visibilitychange', window._trollVisHandler);
    window.removeEventListener('beforeunload', window._trollUnloadHandler);
    window._trollVisHandler    = onVisibility;
    window._trollUnloadHandler = onUnload;
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    // ── Main listener ──
    _trollsRef.on('value', function(snap) {
      _activeTrolls = snap.val() || {};
      if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }

      if (!Object.keys(_activeTrolls).length) {
        applyTrollEffects({});
        return;
      }

      // Read served times from Firebase once — ~20 bytes per troll key
      var keys = Object.keys(_activeTrolls);
      var fetches = keys.map(function(key) {
        return _servedRef(key).once('value').then(function(s) {
          // Only use Firebase value if higher than in-memory (cross-device sync)
          var fbVal = s.val() || 0;
          _servedMs[key] = Math.max(_servedMs[key] || 0, fbVal);
        });
      });

      Promise.all(fetches).then(function() {
        var now = Date.now();
        var validTrolls = {};
        keys.forEach(function(key) {
          var troll     = _activeTrolls[key];
          var remaining = troll.duration - (_servedMs[key] || 0);
          if (remaining > 0) {
            validTrolls[key] = Object.assign({}, troll, { remaining: remaining });
          } else {
            _trollsRef.child(key).remove();
            _clearServed(key);
          }
        });
        applyTrollEffects(validTrolls);
        _startTick();
      });
    });

    // Load troll catalog from Firebase
    _db.ref('config/trollCatalog').once('value').then(function(snap) {
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
      messageBox.style.position = 'fixed';
      messageBox.style.top = '50%';
      messageBox.style.left = '50%';
      messageBox.style.bottom = 'auto';
      messageBox.style.transform = 'translate(-50%, -50%)';
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
        <button onclick="if(typeof openGambleWheel==='function'){openGambleWheel();}else{localStorage.setItem('twc_open_gamble','1');window.location.href='dashboard.html';}" class="btn btn-warning btn-sm">Open Gamble Wheel</button>`;
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
          <p style="margin:2px 0;font-size:0.9rem;">Time remaining: <strong id="trollTimeLeft_${key}">...</strong></p>
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
    // Countdown display updated by _startTick in listenForTrolls
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
      messageBox.style.position = 'fixed';
      messageBox.style.top = 'auto';
      messageBox.style.left = '20px';
      messageBox.style.bottom = '20px';
      messageBox.style.transform = 'none';
      messageBox.style.textAlign = 'left';
      messageBox.style.display = 'block';
    }
    if (indicator) indicator.style.display = 'none';
    if (fakeCursor) fakeCursor.style.display = 'none';
    document.documentElement.style.filter = 'none';
    if (window.cursorDanceInterval) clearInterval(window.cursorDanceInterval);
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
