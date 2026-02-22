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
  limitToLast
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

const room_name = localStorage.getItem("room_name");
const savedPassword = localStorage.getItem("room_password");
const roomPath = `room-messages/${room_name}`;

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
  if (backBtn) backBtn.addEventListener("click", () => window.location.href = "dashboard.html");

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

      // Check room access (especially for DMs)
      const access = await checkRoomAccess();
      if (!access) return;

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
    const presenceRef = ref(database, `rooms/${room_name}/onlineUsers/${currentUserUID}`);
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
      
      update(presenceRef, {
        name: myName,
        state: state
      });
    }

    // Listen for other users
    onValue(ref(database, `rooms/${room_name}/onlineUsers`), (snap) => {
      const bar = $("onlineUsersBar");
      if (!bar) return;
      bar.innerHTML = "";
      if (!snap.exists()) return;

      snap.forEach(child => {
        const u = child.val();
        const statusClass = u.state === 'active' ? 'active' : 'idle';
        const statusText = u.state === 'idle' ? ' (Idle)' : '';
        
        const el = document.createElement("div");
        el.className = "online-user";
        el.innerHTML = `<span class="status-dot ${statusClass}"></span> <span>${u.name}${statusText}</span>`;
        bar.appendChild(el);
      });
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

    onValue(ref(database, `room-read-receipts/${room_name}`), snap => {
      if (snap.exists()) renderReadReceipts(snap.val());
    });

    async function sendMessage() {
      const msg = msgInput.value.trim();
      const file = fileInput.files[0] || null;
      if (!currentUserUID || (!msg && !file)) return;

      if (msg.length > MAX_CHARS) {
        return alert(`Message is too long! Please keep it under ${MAX_CHARS} characters.`);
      }
      if (file && file.size > 5 * 1024 * 1024) return alert("File > 5 MB");

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
        timestamp: Date.now(),
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
            if (!currentUserUID || !roomPath) {
              alert("User not loaded or room not set.");
              return;
            }

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
                badges: userProfile.badges || []
              });

              hideModal();
              gifSearch.value = "";
              gifResults.innerHTML = "";
              scrollToBottom();
              setTimeout(scrollToBottom, 350);
            } catch (err) {
              console.error("Failed to send GIF:", err);
              alert("Failed to send GIF.");
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
    let initialized = false;

    async function loadRecentMessages() {
      const recentRef = query(ref(database, roomPath), limitToLast(50));
      const snapshot = await get(recentRef);

      if (snapshot.exists()) {
        snapshot.forEach(ch => {
          appendMessageToDOM(ch.val(), ch.key);
        });
      }

      scrollToBottom();
      initialized = true;

      // Subscribe to new messages after initial load
      subscribeToNewMessages();
    }

    function subscribeToNewMessages() {
      onChildAdded(query(ref(database, roomPath), limitToLast(50)), snapshot => {
        if (document.getElementById("msg-" + snapshot.key)) return;

        const d = snapshot.val();
        if (initialized) {
          appendMessageToDOM(d, snapshot.key);
          scrollToBottom();

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

    loadRecentMessages();
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
