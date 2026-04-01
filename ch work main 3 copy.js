import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  get,
  set,
  update,
  onValue,
  remove,
  onDisconnect,
  onChildRemoved,
  onChildChanged,
  query,
  limitToLast,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";




const firebaseConfig = {
  apiKey: "AIzaSyCfTDFXdh1tifQIyY6415IORbdXIffYUJ4",
  authDomain: "team-waffles.firebaseapp.com",
  databaseURL: "https://team-waffles-default-rtdb.firebaseio.com",
  projectId: "team-waffles",
  storageBucket: "team-waffles.appspot.com",
  messagingSenderId: "891460090478",
  appId: "1:891460090478:web:c01b6db1af21745769047f",
  measurementId: "G-D9ZY0SVXBN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const database = getDatabase(app);

const storage = getStorage(app);
// <--- Must come BEFORE you use it anywhere

let maintenanceCountdownInterval = null;

// --- SHUTDOWN LISTENER ---
onValue(ref(database, 'config/maintenance'), (snap) => {
  const data = snap.val() || {};
  const overlayId = 'site-shutdown-overlay';
  let overlay = document.getElementById(overlayId);

  if (data.enabled === true) {
    if (sessionStorage.getItem('maintenance_bypassed') === 'true') {
        if (overlay) overlay.remove();
        return;
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = overlayId;
      overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#121212; z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#eee; font-family:'Segoe UI', sans-serif; text-align:center; padding:20px;";
      document.body.appendChild(overlay);
    }
    const imgHTML = data.imageURL ? `<img src="${data.imageURL}" style="max-width:800px; max-height:600px; width:90%; margin-bottom:20px; border-radius:10px; box-shadow:0 0 20px rgba(0,0,0,0.5);">` : '';
    const msgHTML = data.message || "<h1 style='color:#f04747;font-size:2rem;margin-bottom:10px;'>⚠️ SYSTEM MAINTENANCE ⚠️</h1><p style='font-size:1.2rem;color:#ccc;'>The site is currently offline for maintenance.</p>";
    const countdownHTML = `<div id="maint-countdown" style="font-size: 1.5rem; color: #ffc107; margin-top: 15px; font-weight: bold;"></div>`;
    const bypassHTML = `
    <div id="maint-bypass-container" style="margin-top:20px;">
        <button id="maint-bypass-toggle-btn" style="padding:8px 16px; background:rgba(255,255,255,0.1); color:#888; border:1px solid #444; border-radius:4px; cursor:pointer; font-size:0.8rem;">Admin Bypass</button>
        <div id="maint-pin-area" style="display:none; margin-top:10px; display:flex; gap: 5px; justify-content:center; align-items:center;">
            <input type="password" id="maint-pin-input" placeholder="PIN" style="background:rgba(0,0,0,0.5); color:white; border:1px solid #555; border-radius:4px; padding: 8px; text-align:center; width: 100px;">
            <button id="maint-pin-submit-btn" style="padding:8px 16px; background:#5865F2; color:white; border:none; border-radius:4px; cursor:pointer;">Enter</button>
        </div>
    </div>`;
    overlay.innerHTML = `${imgHTML}<div class="shutdown-msg">${msgHTML}</div>${countdownHTML}${bypassHTML}`;
    
    // Countdown Logic
    if (data.endsAt && data.endsAt > Date.now()) {
        const countdownEl = document.getElementById('maint-countdown');
        if (countdownEl) {
            clearInterval(maintenanceCountdownInterval);
            maintenanceCountdownInterval = setInterval(() => {
                const remaining = data.endsAt - Date.now();
                if (remaining <= 0) {
                    clearInterval(maintenanceCountdownInterval);
                    countdownEl.innerHTML = "Maintenance period has ended.";
                    return;
                }
                const d = Math.floor(remaining / 86400000);
                const h = Math.floor((remaining % 86400000) / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                countdownEl.innerHTML = `Time Remaining: ${d > 0 ? d + 'd ' : ''}${h}h ${m}m ${s}s`;
            }, 1000);
        }
    }

    // Bypass Logic
    const toggleBtn = document.getElementById('maint-bypass-toggle-btn');
    const pinArea = document.getElementById('maint-pin-area');
    const submitBtn = document.getElementById('maint-pin-submit-btn');
    const pinInput = document.getElementById('maint-pin-input');
    if (toggleBtn) toggleBtn.onclick = () => { pinArea.style.display = pinArea.style.display === 'none' ? 'flex' : 'none'; if (pinArea.style.display === 'flex') pinInput.focus(); };
    if (submitBtn) {
        const handlePinSubmit = () => {
            const pin = pinInput.value;
            if(!pin) return;
            get(ref(database, 'config/adminPin')).then(pSnap => {
                const realPin = pSnap.exists() ? String(pSnap.val()) : "1234";
                if(pin === realPin) {
                    sessionStorage.setItem('maintenance_bypassed', 'true');
                    overlay.remove();
                    clearInterval(maintenanceCountdownInterval);
                } else {
                    alert("Incorrect PIN");
                    pinInput.value = '';
                }
            });
        };
        submitBtn.onclick = handlePinSubmit;
        pinInput.onkeydown = e => { if (e.key === 'Enter') handlePinSubmit(); };
    }
  } else {
    if (overlay) overlay.remove();
    clearInterval(maintenanceCountdownInterval);
  }
});

// Set persistence to local (so login stays after reload)
setPersistence(auth, browserLocalPersistence).catch(error => {
  console.error("Failed to set auth persistence:", error);
});

/* ───── Constants ───── */
let user_name = null;
let currentUserUID = null;
let profile = null;
let shopConfig = {};
let myPrivateChats = new Set();

const urlParams = new URLSearchParams(window.location.search);
const room_name = urlParams.get('room') || localStorage.getItem("room_name");
const isEmbed = urlParams.get('embed') === 'true';
const savedPassword = localStorage.getItem("room_password");
const isGroupChat = room_name && room_name.startsWith('gc_');
const roomPath = isGroupChat ? `group_chat_messages/${room_name}` : `room-messages/${room_name}`;

if (isEmbed) {
    const style = document.createElement('style');
    style.textContent = `
        #chat_container { height: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }
        body { overflow: hidden; }
        #logo, h1 { display: none !important; }
    `;
    document.head.appendChild(style);
}

/* ───── Helpers ───── */
const $ = id => document.getElementById(id);
const scrollToBottom = () => {
  const out = $("output");
  if (out) out.scrollTop = out.scrollHeight;
};
const formatDate = d => {
  const pad = n => n.toString().padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hrs = d.getHours();
  const ampm = hrs < 12 ? "am" : "pm";
  hrs = hrs % 12 || 12;
  const mins = pad(d.getMinutes());
  return `${day}/${month}/${year}, ${hrs}:${mins}${ampm}`;
};

function triggerBan(code, reason) {
    const banInfo = { code: code || 'ERROR', reason: reason || 'Access Denied.' };
    localStorage.setItem('idheubhduicueiuhdiheis', JSON.stringify(banInfo));
    
    const user = auth.currentUser;
    if (user) {
        set(ref(database, `users/${user.uid}/ban`), banInfo);
        push(ref(database, 'cheat_logs'), {
            uid: user.uid, email: user.email || "Unknown", timestamp: serverTimestamp(), details: `Ban triggered: ${code} - ${reason}`
        });
    }

    if (!document.getElementById('ban-overlay')) {
         window.location.reload();
    }
}

function getOtherUID(uid) {
    if (!room_name || !room_name.startsWith('dm_')) return null;
    const parts = room_name.split('_');
    if (parts.length !== 3) return null;
    return (uid === parts[1]) ? parts[2] : parts[1];
}

function markUnread() {
    if (!currentUserUID) return;
    if (isGroupChat) {
        // For group chats: mark unread for every member except sender
        // Uses group_chats_index/{uid}/{gcId}/unread (same path dashboard listens to)
        get(ref(database, `group_chats/${room_name}/meta/members`)).then(snap => {
            if (!snap.exists()) return;
            const members = snap.val();
            const updates = {};
            Object.keys(members).forEach(uid => {
                if (uid !== currentUserUID) {
                    updates[`group_chats_index/${uid}/${room_name}/unread`] = true;
                }
            });
            if (Object.keys(updates).length) update(ref(database, '/'), updates);
        });
    } else {
        const otherUID = getOtherUID(currentUserUID);
        if (otherUID) {
            // Path is users/{other_user_id}/private_chats/{my_id}
            update(ref(database, `users/${otherUID}/private_chats/${currentUserUID}`), { unread: true });
        }
    }
}

/* ───── Fetch User Profile ───── */
async function getUserProfile(uid) {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) return null;
    return snapshot.val();
  } catch {
    return null;
  }
}

/* ───── Fetch Badge Info ───── */
let badgeInfoMap = {};  // { badgeId: { displayName, description } }

async function loadAllBadges() {
  try {
    const badgesRef = ref(database, "badges"); // Assuming your badges are stored under "badges"
    const snap = await get(badgesRef);
    if (!snap.exists()) return;
    const badges = snap.val();
    // Build map badgeId => {displayName, description}
    badgeInfoMap = {};
    for (const id in badges) {
      badgeInfoMap[id] = {
        displayName: badges[id].displayName || id,
        description: badges[id].description || ""
      };
    }
  } catch (e) {
    console.error("Failed to load badges", e);
  }
}

/* ───── Load Shop Config ───── */
async function loadShopConfig() {
  try {
    const snap = await get(ref(database, "config/shopItems"));
    if (snap.exists()) shopConfig = snap.val();
  } catch (e) {
    console.error("Failed to load shop config", e);
  }
}

/* ───── Load Private Chats ───── */
async function loadMyPrivateChats() {
  if (!currentUserUID) return;
  try {
    const chatsRef = ref(database, `users/${currentUserUID}/private_chats`);
    const snap = await get(chatsRef);
    if (snap.exists()) {
      Object.keys(snap.val()).forEach(uid => myPrivateChats.add(uid));
    }
  } catch (e) {
    console.error("Failed to load private chats", e);
  }
}

/* ───── DOM Ready ───── */
window.addEventListener("DOMContentLoaded", () => {
  const msgInput = $("message");
  const fileInput = $("fileInput");
  const sendBtn = $("sendBtn");
  const gifModal = $("gifModal");
  const gifOpenBtn = $("openGifPicker");
  const gifCloseBtn = $("closeGifModal");
  const gifSearch = $("gifSearch");
  const gifResults = $("gifResults");
  const loader = $("loadingVideo");
  const replyContainer = $("replyContainer");
  const replyingToText = $("replyingToText");
  const cancelReplyBtn = $("cancelReplyBtn");
  const backBtn = $("backButton");
  const panicActivationOverlay = $("panicActivationOverlay");
  const privacyOverlay = $("privacyOverlay");
  const panicContinueBtn = $("panicContinueBtn");

  let currentReply = null;

  function setReply(id, name, text) {
    currentReply = { id, name, text };
    replyingToText.innerText = `Replying to ${name}: ${text}`;
    replyContainer.style.display = "block";
    msgInput.focus();
  }

  function cancelReply() {
    currentReply = null;
    replyContainer.style.display = "none";
  }

  if (cancelReplyBtn) cancelReplyBtn.addEventListener("pointerup", cancelReply);
  if (backBtn) {
    if (isEmbed) {
      backBtn.style.display = "none";
    } else {
      backBtn.addEventListener("click", () => window.location.href = "dashboard.html");
    }
  }

  // --- Hotkey & Panic/Privacy Logic ---
  document.addEventListener('keydown', (e) => {
    if (!currentHotkeys || !privacyOverlay || !panicActivationOverlay) return;

    // Handle events when panic overlay is active
    if (panicActivationOverlay.style.opacity === '1') {
      if (e.key === 'Escape') {
        e.preventDefault();
        panicActivationOverlay.style.opacity = '0';
        panicActivationOverlay.style.pointerEvents = 'none';
        sessionStorage.removeItem("panic_triggered");
      }
      return; // Don't process other hotkeys
    }
    
    // Panic Button
    if (currentHotkeys.panicKey && e.key === currentHotkeys.panicKey) {
      e.preventDefault();
      sessionStorage.setItem("panic_triggered", "true");
      const url = currentHotkeys.panicUrl || "https://www.google.com";
      if (window.self !== window.top) { // Check if in iframe
        window.top.location.href = url;
      } else {
        window.location.href = url;
      }
    }
    // Privacy Hide
    if (currentHotkeys.privacyHideKey && e.key === currentHotkeys.privacyHideKey) {
      const style = currentHotkeys.privacyStyle || 'halted';
      const bgColor = currentHotkeys.privacyBgColor || '#0067b8';
      
      document.documentElement.requestFullscreen().catch(() => {});
      // Reset styles
      privacyOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 20000; display: flex; opacity: 1; pointer-events: all; cursor: none; align-items: center; justify-content: center; flex-direction: column;';
      
      if (style === 'win_update') {
          privacyOverlay.style.background = bgColor;
          privacyOverlay.style.color = bgColor === '#000000' ? '#fff' : '#fff';
          privacyOverlay.style.fontFamily = '"Segoe UI", sans-serif';
          privacyOverlay.style.fontSize = '24px';
          privacyOverlay.innerHTML = `
              <div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top: 4px solid #fff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
              <div style="text-align: center;">Working on updates <span id="win-progress">1</span>% complete.<br>Don't turn off your computer.</div>
              <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
          `;
          let progress = 1;
          const interval = setInterval(() => {
              if(privacyOverlay.style.opacity === '0') { clearInterval(interval); return; }
              if(progress < 100) {
                  progress += Math.floor(Math.random() * 3);
                  if(progress > 100) progress = 100;
                  const el = document.getElementById('win-progress');
                  if(el) el.innerText = progress;
              }
          }, 2000);
      } else if (style === 'restarting') {
          privacyOverlay.style.background = bgColor;
          privacyOverlay.style.color = bgColor === '#000000' ? '#fff' : '#fff';
          privacyOverlay.style.fontFamily = '"Segoe UI", sans-serif';
          privacyOverlay.style.fontSize = '24px';
          privacyOverlay.innerHTML = `
              <div style="width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.2); border-top: 4px solid #fff; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
              <div>Restarting...</div>
              <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
          `;
      } else if (style === 'bsod') {
          privacyOverlay.style.background = bgColor;
          privacyOverlay.style.color = '#fff';
          privacyOverlay.style.fontFamily = '"Segoe UI", sans-serif';
          privacyOverlay.style.fontSize = '24px';
          privacyOverlay.style.alignItems = 'flex-start';
          privacyOverlay.style.padding = '10%';
          privacyOverlay.innerHTML = `
              <div style="font-size: 100px; margin-bottom: 20px;">:(</div>
              <div style="font-size: 24px; margin-bottom: 20px;">Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</div>
              <div style="font-size: 24px; margin-bottom: 40px;"><span id="bsod-progress">0</span>% complete</div>
              <div style="display: flex; align-items: center;">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://bit.ly/twmainc1" style="width: 120px; height: 120px; margin-right: 20px;">
                  <div style="font-size: 14px;">
                      For more information about this issue and possible fixes, visit https://www.windows.com/stopcode<br><br>
                      If you call a support person, give them this info:<br>
                      Stop code: CRITICAL_PROCESS_DIED
                  </div>
              </div>
          `;
          let progress = 0;
          const interval = setInterval(() => {
              if(privacyOverlay.style.opacity === '0') { clearInterval(interval); return; }
              if(progress < 100) {
                  progress += Math.floor(Math.random() * 5);
                  if(progress > 100) progress = 100;
                  const el = document.getElementById('bsod-progress');
                  if(el) el.innerText = progress;
              }
          }, 1000);
      } else if (style === 'matrix') {
          privacyOverlay.style.background = 'black';
          privacyOverlay.innerHTML = '';
          const canvas = document.createElement('canvas');
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          privacyOverlay.appendChild(canvas);
          const ctx = canvas.getContext('2d');
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()';
          const fontSize = 16;
          const columns = canvas.width / fontSize;
          const drops = Array(Math.floor(columns)).fill(1);
          const drawMatrix = () => {
              if(privacyOverlay.style.opacity === '0') return;
              ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#0F0';
              ctx.font = fontSize + 'px monospace';
              for(let i = 0; i < drops.length; i++) {
                  const text = chars[Math.floor(Math.random() * chars.length)];
                  ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                  if(drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
                  drops[i]++;
              }
              requestAnimationFrame(drawMatrix);
          };
          drawMatrix();
      } else if (style === 'terminal') {
          privacyOverlay.style.background = 'black';
          privacyOverlay.style.color = '#0f0';
          privacyOverlay.style.fontFamily = 'monospace';
          privacyOverlay.style.fontSize = '16px';
          privacyOverlay.style.padding = '20px';
          privacyOverlay.style.justifyContent = 'flex-start';
          privacyOverlay.style.alignItems = 'flex-start';
          privacyOverlay.style.overflow = 'hidden';
          privacyOverlay.innerHTML = '<div id="term-content"></div>';
          
          const termContent = document.getElementById('term-content');
          const lines = [
              "Initializing connection...", "Connecting to server 192.168.0.1...", "Bypassing firewall...", "Access granted.",
              "Downloading sensitive data...", "Encrypting files...", "Uploading to remote host...", "Cleaning logs...",
              "System compromise imminent...", "Root access obtained.", "Executing payload...", "Decrypting user passwords...",
              "Fetching database tables...", "Injecting SQL query...", "Packet sniffing started...", "Intercepting traffic...",
              "Compiling assets...", "Bypassing mainframe...", "Accessing kernel...", "Overriding security protocols..."
          ];
          
          const interval = setInterval(() => {
              if(privacyOverlay.style.opacity === '0') { clearInterval(interval); return; }
              const line = lines[Math.floor(Math.random() * lines.length)];
              const p = document.createElement('div');
              p.textContent = `> ${line}`;
              termContent.appendChild(p);
              window.scrollTo(0, document.body.scrollHeight);
              if (termContent.childElementCount > 25) termContent.removeChild(termContent.firstChild);
          }, 150);
      } else {
          privacyOverlay.style.background = currentHotkeys.privacyBgColor || '#000';
          privacyOverlay.style.color = currentHotkeys.privacyBgColor === '#0067b8' ? '#fff' : '#333';
          privacyOverlay.style.fontFamily = 'monospace';
          privacyOverlay.style.fontSize = '12px';
          privacyOverlay.innerHTML = 'System Halted';
      }

      const sb = document.getElementById('fs-sidebar');
      const sbt = document.getElementById('fs-sidebar-toggle');
      if (sb) sb.style.visibility = 'hidden';
      if (sbt) sbt.style.visibility = 'hidden';
    }
    // Privacy Show
    if (currentHotkeys.privacyShowKey && e.key === currentHotkeys.privacyShowKey) {
      privacyOverlay.style.opacity = "0";
      privacyOverlay.style.pointerEvents = "none";
      const sb = document.getElementById('fs-sidebar');
      const sbt = document.getElementById('fs-sidebar-toggle');
      if (sb) sb.style.visibility = 'visible';
      if (sbt) sbt.style.visibility = 'visible';
    }
  });

  if (panicContinueBtn) {
    panicContinueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panicActivationOverlay.style.opacity = '0';
      panicActivationOverlay.style.pointerEvents = 'none';
      sessionStorage.removeItem("panic_triggered");
    });
  }

  window.addEventListener('pageshow', () => {
    const navEntries = performance.getEntriesByType("navigation");
    const navType = navEntries.length > 0 ? navEntries[0].type : '';

    if (navType === 'reload') {
      // On a refresh, always clear the panic state.
      sessionStorage.removeItem("panic_triggered");
    }

    const panicTriggered = sessionStorage.getItem("panic_triggered");
    if (panicTriggered === "true" && panicActivationOverlay) {
        panicActivationOverlay.style.opacity = '1';
        panicActivationOverlay.style.pointerEvents = 'all';
    } else if (panicActivationOverlay) {
        panicActivationOverlay.style.opacity = '0';
        panicActivationOverlay.style.pointerEvents = 'none';
    }
  });

  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);


  function unlockAudio() {
    if (!notifySound) {
      notifySound = new Audio("Ping.mp3");
      notifySound.load();
    }
  }

  // Unlock on most common events
  ["pointerdown", "click", "keydown", "touchstart"].forEach(evt =>
    window.addEventListener(evt, unlockAudio, { once: true })
  );



  /* ───── Favicon & Notification Setup ───── */
  let isWindowFocused = true;
  const originalFavicon = "TWL O.png";
  const newMessageFavicon = "TWL O NOTIFICATION.ico";
  let faviconLink = document.querySelector("link[rel~='icon']");
  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.rel = "icon";
    document.head.appendChild(faviconLink);
  }
  faviconLink.href = originalFavicon;

  window.addEventListener("focus", () => {
    isWindowFocused = true;
    if (faviconLink) faviconLink.href = originalFavicon;
  });
  window.addEventListener("blur", () => {
    isWindowFocused = false;
  });

  if ("Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    } else if (Notification.permission !== "granted") {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `<div style="background:#e22;color:#fff;text-align:center;padding:6px">
           Enable notifications to get new‐message alerts
         </div>`
      );
    }
  }

  let notifySound = null;
  const prepareSound = () => {
    if (!notifySound) {
      notifySound = new Audio("Ping.mp3");
      notifySound.load();
    }
  };
  document.body.addEventListener("pointerup", prepareSound, { once: true });

  /* ───── Read Receipts Helper ───── */
  function updateLastRead() {
    if (!currentUserUID || !room_name || !profile) return;
    const myName = profile.displayName || profile.permanentUsername || "User";
    set(ref(database, `room-read-receipts/${room_name}/${currentUserUID}`), {
      name: myName,
      timestamp: Date.now()
    });
  }

  /* ───── Auth & Initialization ───── */
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (!user.emailVerified) {
        alert("Please verify your email before accessing chat.");
        await auth.signOut();
        location.href = "index.html"; // or login page
        return;
      }
      // User is logged in and verified
      currentUserUID = user.uid;
      profile = await getUserProfile(currentUserUID);
      if (!profile) {
        alert("Failed to load user profile.");
        await auth.signOut();
        location.href = "index.html";
        return;
      }

      // Mark chat as read on open
      if (isGroupChat) {
          // Clear unread flag in group_chats_index for this user
          set(ref(database, `group_chats_index/${user.uid}/${room_name}/unread`), null);
      } else {
          const otherUID = getOtherUID(user.uid);
          if (otherUID) {
              // Path is users/{my_id}/private_chats/{other_user_id}
              update(ref(database, `users/${user.uid}/private_chats/${otherUID}`), { unread: false });
          }
      }

      // Remote ban listener
      onValue(ref(database, "users/" + user.uid + "/ban"), (snapshot) => {
          const banData = snapshot.val();
          if (banData && banData.code && banData.reason) {
              triggerBan(banData.code, banData.reason);
          } else {
              if (localStorage.getItem('idheubhduicueiuhdiheis')) {
                  localStorage.removeItem('idheubhduicueiuhdiheis');
                  window.location.reload();
              }
          }
      });

      // Check room access (especially for DMs)
      const access = await checkRoomAccess();
      if (!access) return;

      loadAndApplyHotkeys();
      loadShopConfig(); // Load shop items to render bubbles correctly
      initPresence();   // Start tracking presence
      await loadMyPrivateChats();
      updateLastRead();
      // Continue loading chat page here, no redirect to login
      initChat();
      scrollToBottom();
    } else {
      // User not logged in, redirect to login
      location.href = "index.html";
    }
  });





  async function checkRoomAccess() {
    console.log("Checking room access...");
    if (!room_name) {
      console.warn("No room selected");
      alert("No room selected");
      location.href = "index.html";
      return false;
    }
    try {
      // Group chats (gc_*) are stored under group_chats/{id}/meta, not rooms/
      if (isGroupChat) {
        const metaRef = ref(database, `group_chats/${room_name}/meta`);
        const s = await get(metaRef);
        if (!s.exists()) {
          console.warn("Group chat not found:", room_name);
          alert("Group chat not found");
          location.href = "dashboard.html";
          return false;
        }
        const meta = s.val();
        if (!meta.members || !meta.members[currentUserUID]) {
          alert("Access denied to group chat.");
          location.href = "dashboard.html";
          return false;
        }
        console.log("Group chat access granted:", room_name);
        return true;
      }

      // Regular rooms and DMs
      const roomMetaRef = ref(database, `rooms/${room_name}`);
      const s = await get(roomMetaRef);
      if (!s.exists()) {
        console.warn("Room not found:", room_name);
        alert("Room not found");
        location.href = "index.html";
        return false;
      }
      const r = s.val();
      if (r.type === "private" && savedPassword !== r.password) {
        console.warn("Incorrect password for room:", room_name);
        alert("Incorrect password");
        location.href = "index.html";
        return false;
      }
      if (r.type === "dm") {
        if (!r.members || !r.members[currentUserUID]) {
          alert("Access denied to private chat.");
          location.href = "dashboard.html";
          return false;
        }
      }
      console.log("Room access granted for room:", room_name);
      return true;
    } catch (err) {
      console.error("Error loading room metadata:", err);
      alert("Failed to load room data");
      location.href = "index.html";
      return false;
    }
  }

  /* ───── Presence System ───── */
  function initPresence() {
    const presencePath = isGroupChat
      ? `group_chats/${room_name}/onlineUsers/${currentUserUID}`
      : `rooms/${room_name}/onlineUsers/${currentUserUID}`;
    const onlineUsersPath = isGroupChat
      ? `group_chats/${room_name}/onlineUsers`
      : `rooms/${room_name}/onlineUsers`;

    const presenceRef = ref(database, presencePath);
    const connectedRef = ref(database, ".info/connected");

    // Handle connection state
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        onDisconnect(presenceRef).remove();
        updatePresenceState();
      }
    });

    // Handle tab focus/blur
    document.addEventListener("visibilitychange", updatePresenceState);

    function updatePresenceState() {
      if (!currentUserUID || !profile) return;
      const state = document.visibilityState === 'visible' ? 'active' : 'idle';
      const myName = profile.displayName || profile.permanentUsername || "Unknown";
      update(presenceRef, { name: myName, state: state });
    }

    // Listen for other users
    const onlineUsersRef = ref(database, onlineUsersPath);
    
    const renderUser = (snap) => {
        const bar = $("onlineUsersBar");
        if (!bar) return;
        const u = snap.val();
        const uid = snap.key;
        let el = document.getElementById(`presence-${uid}`);
        if (!el) {
            el = document.createElement("div");
            el.id = `presence-${uid}`;
            el.className = "online-user";
            bar.appendChild(el);
        }
        const statusClass = u.state === 'active' ? 'active' : 'idle';
        const statusText = u.via === 'Sidebar' ? ' (Sidebar)' : (u.state === 'idle' ? ' (Idle)' : '');
        el.innerHTML = `<span class="status-dot ${statusClass}"></span> <span>${u.name}${statusText}</span>`;
    };

    onChildAdded(onlineUsersRef, renderUser);
    onChildChanged(onlineUsersRef, renderUser);
    onChildRemoved(onlineUsersRef, (snap) => {
        const el = document.getElementById(`presence-${snap.key}`);
        if (el) el.remove();
    });
  }

  /* ───── Main Chat Init ───── */
  function initChat() {
    on(sendBtn, "pointerup", sendMessage);
    on(msgInput, "keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    /* ───── Character Counter Logic ───── */
    const charCounter = $("char-counter");
    const MAX_CHARS = 1000;

    on(msgInput, "input", () => {
      const count = msgInput.value.length;
      if (charCounter) {
        charCounter.textContent = `${count}/${MAX_CHARS}`;
        if (count > MAX_CHARS) {
          charCounter.classList.add("limit-exceeded");
        } else {
          charCounter.classList.remove("limit-exceeded");
        }
      }
    });

    /* ───── Typing Indicator Logic ───── */
    const typingIndicator = $("typingIndicator");
    const typingRef = ref(database, `room-typing/${room_name}/${currentUserUID}`);
    const allTypingRef = ref(database, `room-typing/${room_name}`);
    let isTyping = false;
    let typingTimer = null;

    // 1. Send "I am typing" status
    on(msgInput, "input", () => {
      if (!isTyping) {
        isTyping = true;
        const myName = profile.displayName || profile.permanentUsername || "Someone";
        set(typingRef, myName).catch(console.error);
        onDisconnect(typingRef).remove(); // Auto-remove if tab closes
      }

      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        isTyping = false;
        remove(typingRef).catch(console.error);
        onDisconnect(typingRef).cancel();
      }, 2000); // Stop showing after 2 seconds of no input
    });

    // 2. Listen for others typing
    onValue(allTypingRef, (snapshot) => {
      if (!typingIndicator) return;
      const data = snapshot.val() || {};
      // Filter out my own ID
      const names = Object.keys(data)
        .filter(uid => uid !== currentUserUID)
        .map(uid => data[uid]);

      if (names.length > 0) {
        const text = names.length > 3
          ? "Several people are typing..."
          : `${names.join(", ")} ${names.length === 1 ? "is" : "are"} typing...`;
        typingIndicator.textContent = text;
        typingIndicator.style.display = "block";
      } else {
        typingIndicator.style.display = "none";
      }
    });

    function renderReadReceipts(readData) {
      const myMessages = document.querySelectorAll('.chat-message.self');
      myMessages.forEach(msgDiv => {
        const msgTime = parseInt(msgDiv.dataset.timestamp || 0);
        if (!msgTime) return;
        const readers = Object.keys(readData).filter(uid => uid !== currentUserUID && readData[uid].timestamp > msgTime).map(uid => readData[uid].name);
        let receiptDiv = msgDiv.querySelector('.read-receipt');
        if (!receiptDiv) { receiptDiv = document.createElement('div'); receiptDiv.className = 'read-receipt'; msgDiv.appendChild(receiptDiv); }
        receiptDiv.innerText = readers.length > 0 ? (readers.length <= 3 ? "Read by " + readers.join(", ") : "Read by " + readers.length + " people") : "";
      });
    }

    // OPTIMIZED: Read Receipts using child events
    const readReceiptsData = {};
    const rrRef = ref(database, `room-read-receipts/${room_name}`);
    
    const handleRR = (snap) => {
        readReceiptsData[snap.key] = snap.val();
        renderReadReceipts(readReceiptsData);
    };
    
    onChildAdded(rrRef, handleRR);
    onChildChanged(rrRef, handleRR);
    onChildRemoved(rrRef, snap => {
        delete readReceiptsData[snap.key];
        renderReadReceipts(readReceiptsData);
    });

    // ── Send lock & cooldown (shared by text, file, and GIF sends) ──
    let _sending    = false;  // synchronous boolean — blocks re-entry before any await
    let _lastSent   = 0;
    const COOLDOWN_MS = 3000;

    function _canSend() {
      if (_sending) return false;
      if (Date.now() - _lastSent < COOLDOWN_MS) return false;
      return true;
    }

    function _acquireLock() {
      _sending  = true;
      _lastSent = Date.now();
    }

    function _releaseLock() {
      _sending = false;
    }

    function startSendCooldown() {
      sendBtn.disabled  = true;
      const start       = Date.now();
      const svgOriginal = sendBtn.innerHTML;
      sendBtn.innerHTML = `
        <svg viewBox="0 0 40 40" width="28" height="28" style="transform:rotate(-90deg)">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3"/>
          <circle id="cdRing" cx="20" cy="20" r="16" fill="none" stroke="#0084ff" stroke-width="3"
            stroke-dasharray="100.5" stroke-dashoffset="100.5" stroke-linecap="round"/>
          <text x="20" y="25" text-anchor="middle" fill="#fff" font-size="13"
            style="transform:rotate(90deg) translate(0,-40px);font-family:sans-serif;font-weight:bold;"
            id="cdText">3</text>
        </svg>`;
      sendBtn.style.opacity = '0.7';
      const ring = sendBtn.querySelector('#cdRing');
      const txt  = sendBtn.querySelector('#cdText');
      const tick = setInterval(function () {
        const elapsed   = Date.now() - start;
        const remaining = Math.max(0, COOLDOWN_MS - elapsed);
        if (ring) ring.style.strokeDashoffset = 100.5 * (1 - elapsed / COOLDOWN_MS);
        if (txt)  txt.textContent = Math.ceil(remaining / 1000);
        if (elapsed >= COOLDOWN_MS) {
          clearInterval(tick);
          sendBtn.innerHTML    = svgOriginal;
          sendBtn.style.opacity = '';
          sendBtn.disabled     = false;
          _releaseLock();
        }
      }, 50);
    }

    async function sendMessage() {
      if (!_canSend()) return;          // synchronous check — blocks autoclicker
      const msg  = msgInput.value.trim();
      const file = fileInput.files[0] || null;
      if (!currentUserUID || (!msg && !file)) return;
      if (msg.length > MAX_CHARS) return alert(`Message is too long! Please keep it under ${MAX_CHARS} characters.`);
      if (file && file.size > 5 * 1024 * 1024) return alert("File > 5 MB");

      _acquireLock();         // set BEFORE any await — nothing else can enter now
      startSendCooldown();

      // Mark as unread for the other user
      markUnread();

      const userProfile = profile || await getUserProfile(currentUserUID);
      if (!userProfile) return alert("User profile data not found. Try reloading.");

      const bg = userProfile.equipped || "default";
      const base = {
        senderUID: currentUserUID,
        permanentUsername: userProfile.permanentUsername || userProfile.displayName || currentUserUID,
        displayName: userProfile.displayName || userProfile.permanentUsername || currentUserUID,
        profilePicURL: userProfile.profilePicURL || null,
        message: msg,
        replyTo: currentReply ? {
          id: currentReply.id,
          sender: currentReply.name,
          text: currentReply.text
        } : null,
        timestamp: serverTimestamp(),
        dateSent: formatDate(new Date()),
        like: 0,
        reactions: {},
        badges: userProfile.badges || [],
        background: bg
      };


      const finish = () => {
        msgInput.value = "";
        fileInput.value = "";
        cancelReply();
        scrollToBottom();
      };

      if (file) {
        loader.hidden = false;
        const path = `files/${Date.now()}_${file.name}`;
        const storageRef = sRef(storage, path);
        try {
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          await push(ref(database, roomPath), { ...base, fileURL: url });
          loader.hidden = true;
          finish();
        } catch (error) {
          loader.hidden = true;
          console.error("Storage Error:", error);
          alert("Upload failed: " + error.message);
        }
      } else {
        push(ref(database, roomPath), base).then(finish).catch(console.error);
      }
    }

    /* ───── GIF Picker ───── */
    const showModal = () => { if (gifModal) gifModal.style.display = "block"; };
    const hideModal = () => { if (gifModal) gifModal.style.display = "none"; };

    if (gifResults) {
      gifResults.style.cssText = `
        max-height: 60vh;
        overflow-y: auto;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        padding: 4px;
      `;
    }

    function addTapListener(el, handler) {
      if (!el) return;
      const THRESHOLD = 10;
      let startX, startY;
      el.addEventListener("pointerdown", e => {
        startX = e.clientX; startY = e.clientY;
      }, { passive: true });
      el.addEventListener("pointerup", e => {
        if (Math.abs(e.clientX - startX) <= THRESHOLD && Math.abs(e.clientY - startY) <= THRESHOLD) handler(e);
      }, { passive: true });
    }

    addTapListener(gifOpenBtn, e => { e.stopPropagation(); showModal(); });
    addTapListener(gifCloseBtn, e => { e.stopPropagation(); hideModal(); });
    window.addEventListener("pointerup", e => { if (e.target === gifModal) hideModal(); });

    let currentCtrl = null, debounceId = null;
    gifSearch?.addEventListener("input", () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(runSearch, 300);
    });

    async function runSearch() {
      const query = gifSearch.value.trim();
      if (query.length < 2) {
        gifResults.innerHTML = "";
        return;
      }
      if (currentCtrl) currentCtrl.abort();
      currentCtrl = new AbortController();
      gifResults.innerHTML = "<p style='padding:8px'>Searching…</p>";

      try {
        const response = await fetch(
          `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyBRfNHcJYTENDZ7Df_8Gh1C5PNjtZE2bU8&limit=20`,
          { signal: currentCtrl.signal }
        );
        if (!response.ok) throw new Error("GIF fetch failed");
        const data = await response.json();
        gifResults.innerHTML = "";
        if (!data.results.length) {
          gifResults.innerHTML = "<p style='padding:8px'>No GIFs found.</p>";
          return;
        }

        data.results.forEach(g => {
          const url = g.media_formats?.mediumgif?.url || g.media_formats?.gif?.url;
          if (!url) return;
          const img = new Image();
          img.src = url;
          img.style.cssText = "max-width:140px;border-radius:6px;cursor:pointer";

          addTapListener(img, async () => {
            if (!currentUserUID || !roomPath) { alert("User not loaded or room not set."); return; }
            if (!_canSend()) return;   // synchronous — blocks autoclicker at first line

            _acquireLock();            // set BEFORE any await
            startSendCooldown();

            try {
              const userProfile = await getUserProfile(currentUserUID);
              if (!userProfile) throw new Error("Profile not found.");

              await push(ref(database, roomPath), {
                senderUID: currentUserUID,
                permanentUsername: userProfile.permanentUsername || userProfile.displayName || currentUserUID,
                displayName: userProfile.displayName || userProfile.permanentUsername || currentUserUID,
                profilePicURL: userProfile.profilePicURL || null,

                message: "",
                gifURL: url,
                dateSent: formatDate(new Date()),
                like: 0,
                reactions: {},
                badges: userProfile.badges || [],
                timestamp: serverTimestamp()
              });

              hideModal();
              gifSearch.value = "";
              gifResults.innerHTML = "";
              scrollToBottom();
              setTimeout(scrollToBottom, 350);
            } catch (err) {
              console.error("Failed to send GIF:", err);
              alert("Failed to send GIF.");
              _releaseLock();
            }
          });

          gifResults.appendChild(img);
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("GIF search error:", err);
          gifResults.innerHTML = "<p style='color:#e22;padding:8px'>Error loading GIFs</p>";
        }
      }
    }

    /* ───── Load Recent & Subscribe to New Messages ───── */
    const output = $("output");

    function subscribeToNewMessages() {
      onChildAdded(query(ref(database, roomPath), limitToLast(50)), snapshot => {
        if (document.getElementById("msg-" + snapshot.key)) return;

        const d = snapshot.val();
        appendMessageToDOM(d, snapshot.key);
        scrollToBottom();

        // Only notify if message is actually new (within last 30 seconds)
        const isRecent = (Date.now() - (d.timestamp || 0)) < 30000;

        if (isRecent) {
            if (isWindowFocused) updateLastRead();
            if (!isWindowFocused) {
              if (faviconLink) faviconLink.href = newMessageFavicon;
              try { notifySound?.play(); } catch { }
            }
            if (!isWindowFocused && Notification.permission === "granted") {
            const sender = d.displayName || d.permanentUsername || "Unknown";
            const text = d.message || "(sent a GIF)";
            new Notification(`New message from: ${sender}`, {
              body: text,
              icon: originalFavicon
            });
          }
        }
      });

      // Listen for message deletions
      onChildRemoved(ref(database, roomPath), snapshot => {
        const el = document.getElementById("msg-" + snapshot.key);
        if (el) el.remove();
      });

      // Listen for message edits
      onChildChanged(ref(database, roomPath), snapshot => {
        const d = snapshot.val();
        const el = document.getElementById("msg-" + snapshot.key);
        if (el) {
          const contentDiv = el.querySelector(".message-content");
          if (contentDiv) {
            let replyHtml = "";
            if (d.replyTo) {
              replyHtml = `<div class="reply-context" onclick="const el = document.getElementById('msg-${d.replyTo.id}'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'})"><strong>${d.replyTo.sender}</strong> ${d.replyTo.text}</div>`;
            }
            const safeMessage = d.message ? `<p>${d.message}</p>` : "";
            const gifBlock = d.gifURL ? `<img src="${d.gifURL}" class="gif-message" loading="lazy">` : "";
            const fileBlock = d.fileURL ? `<a href="${d.fileURL}" class="file-download" target="_blank">Download file</a>` : "";
            contentDiv.innerHTML = replyHtml + safeMessage + gifBlock + fileBlock;
          }
        }
      });
    }

    /* ───── Badge tooltip helper ───── */
    function createBadgeElement(badgeId) {
      const info = badgeInfoMap[badgeId] || { displayName: badgeId, description: "" };
      const span = document.createElement("span");
      span.className = "badge";
      span.textContent = info.displayName;

      // Tooltip element
      const tooltip = document.createElement("div");
      tooltip.className = "badge-tooltip";
      tooltip.textContent = info.description;
      span.appendChild(tooltip);

      // Show/hide tooltip on hover
      span.addEventListener("mouseenter", () => {
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible";
      });
      span.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
      });

      // Optional: toggle tooltip on click for mobile friendliness
      span.addEventListener("click", (e) => {
        e.stopPropagation();
        if (tooltip.style.visibility === "visible") {
          tooltip.style.opacity = "0";
          tooltip.style.visibility = "hidden";
        } else {
          tooltip.style.opacity = "1";
          tooltip.style.visibility = "visible";
        }
      });

      // Hide all tooltips if clicking outside
      document.body.addEventListener("click", () => {
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
      });

      return span;
    }

    function appendMessageToDOM(d, key) {
      if (!output) return;

      const senderName = d.displayName || d.permanentUsername || "Unknown";
      const permUsername = d.permanentUsername || d.displayName || "Unknown";

      // Build badges HTML with display names and tooltips
      const badgesHtmlElements = (d.badges || []).map(createBadgeElement);

      let replyHtml = "";
      if (d.replyTo) {
        replyHtml = `<div class="reply-context" onclick="const el = document.getElementById('msg-${d.replyTo.id}'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'})">
          <strong>${d.replyTo.sender}</strong> ${d.replyTo.text}
        </div>`;
      }

      const profilePicHtml = d.profilePicURL && typeof d.profilePicURL === "string"
        ? `<img class="user_pic" src="${d.profilePicURL}" alt="User picture">`
        : `<img class="user_pic" src="TWL O.png" alt="Default profile picture">`;

      let bgClass = ""; 
      let bgStyle = "";

      if (d.background && d.background !== "default") {
        bgClass = `bubble-${d.background}`;
        // Check if we have a custom style for this ID in shopConfig
        if (shopConfig[d.background] && shopConfig[d.background].style) {
           bgStyle = `background: ${shopConfig[d.background].style};`;
        }
      }


      const safeMessage = d.message ? `<p>${d.message}</p>` : "";
      const gifBlock = d.gifURL ? `<img src="${d.gifURL}" class="gif-message" loading="lazy">` : "";
      const fileBlock = d.fileURL ? `<a href="${d.fileURL}" class="file-download" target="_blank">Download file</a>` : "";
      const date = d.dateSent || "Unknown date";

      const isMe = d.senderUID === currentUserUID;
      const div = document.createElement("div");
      div.id = "msg-" + key;
      div.dataset.timestamp = d.timestamp || 0;
      div.className = `chat-message ${isMe ? 'self' : 'other'} ${bgClass}`;
      if (bgStyle) div.style.cssText = bgStyle; // Apply custom background
      div.innerHTML = `
        <div class="message-header">
          ${profilePicHtml}
          <div class="message-sender">
            <strong>${senderName}</strong> <small>(${permUsername})</small>
          </div>
        </div>
        <div class="message-content">
          ${replyHtml}
          ${safeMessage}
          ${gifBlock}
          ${fileBlock}
        </div>
        <div class="message-footer">
          <span class="time_date">${date}</span>
        </div>
      `;

      // Append badges after the sender name
      const senderDiv = div.querySelector(".message-sender strong");
      badgesHtmlElements.forEach(badgeEl => senderDiv.appendChild(badgeEl));

      // Add Reply Button
      const replyBtn = document.createElement("span");
      replyBtn.className = "reply-btn";
      replyBtn.innerHTML = "↩️";
      replyBtn.title = "Reply";
      replyBtn.onclick = () => {
        let text = d.message || (d.gifURL ? "[GIF]" : (d.fileURL ? "[File]" : "[Content]"));
        if (text.length > 30) text = text.substring(0, 30) + "...";
        setReply(key, senderName, text);
      };
      div.querySelector(".message-footer").prepend(replyBtn);

      // Add Edit Button if self and is a text message
      if (isMe && d.message) {
        const editBtn = document.createElement("span");
        editBtn.className = "edit-btn";
        editBtn.innerHTML = "✎";
        editBtn.title = "Edit Message";
        editBtn.onclick = () => {
             const currentEl = document.getElementById("msg-" + key);
             const currentText = currentEl ? currentEl.querySelector(".message-content p").innerText : d.message;
             const newMsg = prompt("Edit your message:", currentText);
             if(newMsg !== null && newMsg.trim() !== "" && newMsg !== currentText) {
                 update(ref(database, `${roomPath}/${key}`), { message: newMsg });
             }
        };
        div.querySelector(".message-footer").prepend(editBtn);
      }

      // Add Delete Button if self
      if (isMe) {
        const delBtn = document.createElement("span");
        delBtn.className = "delete-btn";
        delBtn.innerHTML = "🗑️";
        delBtn.title = "Delete Message";
        delBtn.onclick = () => {
             if(confirm("Delete this message?")) {
                 remove(ref(database, `${roomPath}/${key}`)).catch(err => alert(err.message));
             }
        };
        div.querySelector(".message-footer").prepend(delBtn);
      }

      // Add PM Button if not self AND not already in DM
      if (d.senderUID && !isMe && !myPrivateChats.has(d.senderUID)) {
        const pmBtn = document.createElement("span");
        pmBtn.innerText = " ✉️";
        pmBtn.style.cursor = "pointer";
        pmBtn.title = "Send Private Message Request";
        pmBtn.onclick = () => sendPMRequest(d.senderUID, d.displayName || d.permanentUsername);
        // Append to sender line
        div.querySelector(".message-sender").appendChild(pmBtn);
      }

      output.appendChild(div);
    }

    subscribeToNewMessages();
  }
});

async function sendPMRequest(targetUID, targetName) {
  if (myPrivateChats.has(targetUID)) {
    alert("You are already in a private chat with this user.");
    return;
  }

  if (!confirm(`Send private message request to ${targetName}?`)) return;

  try {
    const myProfile = await getUserProfile(currentUserUID);
    const myName = myProfile.displayName || myProfile.permanentUsername || "Unknown";

    await set(ref(database, `pm_requests/${targetUID}/${currentUserUID}`), {
      fromUID: currentUserUID,
      fromName: myName,
      timestamp: Date.now()
    });
    alert("Request sent!");
  } catch (e) {
    console.error(e);
    alert("Failed to send request.");
  }
}

  // --- Global Hotkey Logic ---
  let currentHotkeys = {};
  
  function loadAndApplyHotkeys() {
    try {
      const hotkeysJSON = localStorage.getItem('twc_hotkeys');
      if (hotkeysJSON) {
        currentHotkeys = JSON.parse(hotkeysJSON);
      }
    } catch (e) {
      console.error("Could not load hotkeys from localStorage", e);
    }
  }



/* ───── Load Badges for Current User ───── */
function loadUserBadges() {
  const userBadgesRef = ref(database, `user-badges/${currentUsername}`);
  const badgesMetaRef = ref(database, `badges`);

  // First get all badge metadata once
  get(badgesMetaRef).then(badgesSnap => {
    if (!badgesSnap.exists()) return;
    const allBadges = badgesSnap.val();

    // Then get user's badge IDs
    get(userBadgesRef).then(userBadgesSnap => {
      if (!userBadgesSnap.exists()) return;
      const userBadgeIds = userBadgesSnap.val(); // expected as array or object keys

      const container = document.getElementById("badge-container");
      container.innerHTML = ""; // clear existing badges

      // Iterate over user badges
      Object.keys(userBadgeIds).forEach(badgeId => {
        if (!allBadges[badgeId]) return;

        const badgeInfo = allBadges[badgeId];

        // Create badge element
        const badge = document.createElement("div");
        badge.classList.add("badge");
        badge.textContent = badgeInfo.displayName || badgeId;

        // Create tooltip
        const tooltip = document.createElement("div");
        tooltip.classList.add("badge-tooltip");
        tooltip.textContent = badgeInfo.description || "No description available";

        badge.appendChild(tooltip);

        // Show tooltip on hover or focus
        badge.addEventListener("mouseenter", () => {
          tooltip.style.opacity = "1";
          tooltip.style.visibility = "visible";
        });
        badge.addEventListener("mouseleave", () => {
          tooltip.style.opacity = "0";
          tooltip.style.visibility = "hidden";
        });

        // Also show tooltip on keyboard focus for accessibility
        badge.setAttribute("tabindex", "0");
        badge.addEventListener("focus", () => {
          tooltip.style.opacity = "1";
          tooltip.style.visibility = "visible";
        });
        badge.addEventListener("blur", () => {
          tooltip.style.opacity = "0";
          tooltip.style.visibility = "hidden";
        });

        container.appendChild(badge);
      });
    });

  });
}

// Anti-Console: Detects DevTools open via debugger timing
setInterval(() => {
    const start = performance.now();
    debugger; 
    if (performance.now() - start > 100) {
        triggerBan('CODE_5_CONSOLE', 'Console usage detected.');
    }
}, 1000);
