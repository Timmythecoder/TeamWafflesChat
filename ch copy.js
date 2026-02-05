import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import {
  getDatabase, ref, push,
  onValue, get
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";
import {
  getStorage, ref as sRef,
  uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

/* ───── Firebase init ───── */
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
const database = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

/* ───── Constants ───── */
const user_name = localStorage.getItem("user_name");
const room_name = localStorage.getItem("room_name");
const savedPassword = localStorage.getItem("room_password");
const roomPath = `rooms/${room_name}`;

/* ───── Helpers ───── */
const $ = id => document.getElementById(id);
const scrollToBottom = () => { $("output").scrollTop = $("output").scrollHeight; };
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

  const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);




let notifySound = null;

const prepareSound = () => {
  if (!notifySound) {
    notifySound = new Audio("Ping.mp3");
    notifySound.load(); // preload
  }
};

document.body.addEventListener("pointerup", prepareSound, { once: true });



let isWindowFocused = true;
let originalFavicon = "TWL O.png";
let newMessageFavicon = "TWL O NOTIFICATION.ico"; // Add this icon file to your project
let faviconLink = document.querySelector("link[rel~='icon']");

window.addEventListener("focus", () => {
  isWindowFocused = true;
  if (faviconLink) faviconLink.href = originalFavicon;
});

window.addEventListener("blur", () => {
  isWindowFocused = false;
});








  on(sendBtn, "pointerup", sendMessage);
  on(msgInput, "keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  function sendMessage() {
    const msg = msgInput.value.trim();
    const file = fileInput.files[0] || null;
    if (!user_name || (!msg && !file)) return alert("Type a message or pick a file");
    if (msg && msg.split(/\s+/).length > 50) return alert("Message exceeds 50 words");
    if (file && file.size > 5 * 1024 * 1024) return alert("File > 5 MB");

    const base = {
      name: user_name,
      message: msg,
      dateSent: formatDate(new Date()),
      like: 0,
      reactions: {}
    };
    const finish = () => {
      msgInput.value = "";
      fileInput.value = "";
      scrollToBottom();
    };

    if (file) {
      loader.hidden = false;
      const p = `files/${Date.now()}_${file.name}`;
      const refIn = sRef(storage, p);
      uploadBytes(refIn, file)
        .then(() => getDownloadURL(refIn))
        .then(url => push(ref(database, roomPath), { ...base, fileURL: url }))
        .then(() => { loader.hidden = true; finish(); })
        .catch(e => { loader.hidden = true; alert("Upload failed"); console.error(e); });
    } else {
      push(ref(database, roomPath), base).then(finish).catch(console.error);
    }
  }

  /* ───── GIF Picker ───── */
  const showModal = () => gifModal.style.display = "block";
  const hideModal = () => gifModal.style.display = "none";

  gifResults.style.cssText = `
    max-height: 60vh;
    overflow-y: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    padding: 4px;
  `;

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

  function runSearch() {
    const query = gifSearch.value.trim();
    if (query.length < 2) { gifResults.innerHTML = ""; return; }
    if (currentCtrl) currentCtrl.abort();
    currentCtrl = new AbortController();
    gifResults.innerHTML = "<p style='padding:8px'>Searching…</p>";
    fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyBRfNHcJYTENDZ7Df_8Gh1C5PNjtZE2bU8&limit=20`, { signal: currentCtrl.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        gifResults.innerHTML = "";
        if (!data.results.length) return gifResults.innerHTML = "<p style='padding:8px'>No GIFs found.</p>";
        data.results.forEach(g => {
          const url = g.media_formats?.mediumgif?.url || g.media_formats?.gif?.url;
          if (!url) return;
          const img = new Image();
          img.src = url;
          img.style.cssText = "max-width:140px;border-radius:6px;cursor:pointer";
          addTapListener(img, () => {
            push(ref(database, roomPath), {
              name: user_name,
              message: "",
              gifURL: url,
              dateSent: formatDate(new Date()),
              like: 0,
              reactions: {}
            }).then(() => {
              hideModal();
              gifSearch.value = "";
              gifResults.innerHTML = "";
              scrollToBottom();
              setTimeout(scrollToBottom, 350);
            });
          });
          gifResults.appendChild(img);
        });
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        console.error(err);
        gifResults.innerHTML = "<p style='color:#e22;padding:8px'>Error loading GIFs</p>";
      });
  }

  /* ───── Realtime Feed ───── */
  const chatRef = ref(database, roomPath);
  onValue(chatRef, snap => {
    const out = $("output");
    out.innerHTML = "";
    const frag = document.createDocumentFragment();
    snap.forEach(ch => {
      const d = ch.val();
      if (!(d?.name && (d.message || d.gifURL || d.fileURL))) return;
      const div = document.createElement("div");
      div.innerHTML = `
        <h4>${d.name} <img class="user_tick" src="TWL O.png"></h4>
        ${d.message ? `<p>${d.message}</p>` : ""}
        ${d.gifURL ? `<img src="${d.gifURL}" style="max-width:200px">` : ""}
        ${d.fileURL ? `<a href="${d.fileURL}" target="_blank">Download file</a>` : ""}
        <p><span class="time_date">${d.dateSent}</span></p><hr>`;
      frag.appendChild(div);
    });
    out.appendChild(frag);
    const imgs = [...out.querySelectorAll("img")];
    if (!imgs.length) scrollToBottom();
    else {
      let done = 0;
      imgs.forEach(i => i.onload = i.onerror = () => {
        if (++done === imgs.length) scrollToBottom();
      });
    }




if (!isWindowFocused) {
  if (faviconLink) faviconLink.href = newMessageFavicon;
  if (notifySound) notifySound.play().catch(console.warn); // Safe attempt
}





// Notify only on new message when not focused
if (!isWindowFocused) {
  if (faviconLink) faviconLink.href = newMessageFavicon;
}



if (!isWindowFocused) {
  if (faviconLink) faviconLink.href = newMessageFavicon;
  new Audio('Ping.mp3').play(); // make sure notify.mp3 exists
}


  });
});

/* ───── Room Access Check ───── */
(function roomGate() {
  if (!room_name) return alert("No room selected"), location.href = "index.html";
  const roomMetaRef = ref(database, `rooms/${room_name}`);
  get(roomMetaRef).then(s => {
    if (!s.exists()) return bad("Room not found", "index.html");
    const r = s.val();
    if (r.type === "private" && savedPassword !== r.password) return bad("Incorrect password", "dashboard.html");
  }).catch(console.error);
  function bad(msg, dest) { alert(msg); location.href = dest; }
})();

/* ───── Notification Banner ───── */
if (Notification.permission === "default") {
  Notification.requestPermission();
} else if (Notification.permission !== "granted") {
  document.body.insertAdjacentHTML("afterbegin",
    `<div style="background:#e22;color:#fff;text-align:center;padding:6px">
      Enable notifications to get new-message alerts
     </div>`);
}
