import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  get
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

const room_name = localStorage.getItem("room_name");
const savedPassword = localStorage.getItem("room_password");
const roomPath = `rooms/${room_name}/messages`;

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

/* ───── DOM Ready ───── */
window.addEventListener("DOMContentLoaded", () => {
  const msgInput   = $("message");
  const fileInput  = $("fileInput");
  const sendBtn    = $("sendBtn");
  const gifModal   = $("gifModal");
  const gifOpenBtn = $("openGifPicker");
  const gifCloseBtn= $("closeGifModal");
  const gifSearch  = $("gifSearch");
  const gifResults = $("gifResults");
  const loader     = $("loadingVideo");

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
  const originalFavicon    = "TWL O.png";
  const newMessageFavicon  = "TWL O NOTIFICATION.ico";
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
    console.log("Room access granted for room:", room_name);
    return true;
  } catch (err) {
    console.error("Error loading room metadata:", err);
    alert("Failed to load room data");
    location.href = "index.html";
    return false;
  }
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

    async function sendMessage() {
      const msg = msgInput.value.trim();
      const file = fileInput.files[0] || null;
if (!currentUserUID || (!msg && !file)) return alert("Type a message or pick a file"); // FIX FOR NO MESSAGE FOUND DUE TO USERNAME CRAP
      if (msg && msg.split(/\s+/).length > 50) return alert("Message exceeds 50 words");
      if (file && file.size > 5 * 1024 * 1024) return alert("File > 5 MB");

      const userProfile = await getUserProfile(currentUserUID);
      if (!userProfile) return alert("User profile data not found.");

     const base = {
  permanentUsername: userProfile.permanentUsername || userProfile.displayName || currentUserUID,
  displayName:       userProfile.displayName    || userProfile.permanentUsername || currentUserUID,
  profilePicURL:     userProfile.profilePicURL || null,
  message:           msg,
  dateSent:          formatDate(new Date()),
  like:              0,
  reactions:         {},
  badges:            userProfile.badges || []
};


      const finish = () => {
        msgInput.value = "";
        fileInput.value = "";
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
        } catch {
          loader.hidden = true;
          alert("Upload failed");
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
                permanentUsername: userProfile.permanentUsername || userProfile.displayName || currentUserUID,
                displayName:       userProfile.displayName    || userProfile.permanentUsername || currentUserUID,
profilePicURL:  userProfile.profilePicURL || null,

                message:           "",
                gifURL:            url,
                dateSent:          formatDate(new Date()),
                like:              0,
                reactions:         {},
                badges:            userProfile.badges || []
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
      const recentRef = ref(database, roomPath);
      const snapshot = await get(recentRef);

      if (snapshot.exists()) {
        snapshot.forEach(ch => {
          appendMessageToDOM(ch.val());
        });
      }

      scrollToBottom();
      initialized = true;

      // Subscribe to new messages after initial load
      subscribeToNewMessages();
    }

    function subscribeToNewMessages() {
      onChildAdded(ref(database, roomPath), snapshot => {
        const d = snapshot.val();
        if (initialized) {
          appendMessageToDOM(d);
          scrollToBottom();

          if (!isWindowFocused && Notification.permission === "granted") {
            const sender = d.displayName || d.permanentUsername || "Unknown";
            const text = d.message || "(sent a GIF)";
            new Notification(`New message from: ${sender}`, {
              body: text,
              icon: originalFavicon
            });
            try {
              notifySound?.play();
            } catch {}
            if (faviconLink) faviconLink.href = newMessageFavicon;
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

    function appendMessageToDOM(d) {
      if (!output) return;

      const senderName  = d.displayName || d.permanentUsername || "Unknown";
      const permUsername = d.permanentUsername || d.displayName || "Unknown";

      // Build badges HTML with display names and tooltips
      const badgesHtmlElements = (d.badges || []).map(createBadgeElement);

const profilePicHtml = d.profilePicURL && typeof d.profilePicURL === "string"
  ? `<img class="user_pic" src="${d.profilePicURL}" alt="User picture">`
  : `<img class="user_pic" src="TWL O - Copy.png" alt="Default profile picture">`;


      const safeMessage = d.message ? `<p>${d.message}</p>` : "";
      const gifBlock    = d.gifURL   ? `<img src="${d.gifURL}" class="gif-message" loading="lazy">` : "";
      const fileBlock   = d.fileURL  ? `<a href="${d.fileURL}" class="file-download" target="_blank">Download file</a>` : "";
      const date        = d.dateSent || "Unknown date";

      const div = document.createElement("div");
      div.className = "chat-message";
      div.innerHTML = `
        <div class="message-header">
          ${profilePicHtml}
          <div class="message-sender">
            <strong>${senderName}</strong> <small>(${permUsername})</small>
          </div>
        </div>
        <div class="message-content">
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

      output.appendChild(div);
    }

    loadRecentMessages();
  }
});


     

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
