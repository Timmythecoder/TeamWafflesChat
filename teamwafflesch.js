var firebaseConfig = {
    apiKey: "AIzaSyCfTDFXdh1tifQIyY6415IORbdXIffYUJ4",
    authDomain: "team-waffles.firebaseapp.com",
    databaseURL: "https://team-waffles-default-rtdb.firebaseio.com",
    projectId: "team-waffles",
    storageBucket: "team-waffles.appspot.com",
    messagingSenderId: "891460090478",
    appId: "1:891460090478:web:c01b6db1af21745769047f",
  };
  
  
  
    firebase.initializeApp(firebaseConfig);

    let maintenanceCountdownInterval = null;

    // --- SHUTDOWN LISTENER ---
    firebase.database().ref('config/maintenance').on('value', snap => {
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
                firebase.database().ref('config/adminPin').once('value').then(pSnap => {
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

    // --- BROADCAST LISTENER ---
    function showBroadcastPopup(message) {
        if (!document.getElementById('broadcast-popup-styles')) {
            const style = document.createElement('style');
            style.id = 'broadcast-popup-styles';
            style.textContent = `
                .broadcast-popup-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:2147483647; display:flex; align-items:center; justify-content:center; animation: broadcastFadeIn 0.3s ease; }
                .broadcast-popup-content { background:#2f3136; color:#dcddde; padding:25px; border-radius:10px; max-width:450px; width:90%; text-align:center; box-shadow:0 5px 25px rgba(0,0,0,0.5); border:1px solid #40444b; }
                .broadcast-popup-content h3 { color:#5865F2; margin-top:0; }
                .broadcast-popup-content p { line-height:1.6; }
                .broadcast-popup-content button { background:#5865F2; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer; margin-top:15px; }
                @keyframes broadcastFadeIn { from { opacity:0; } to { opacity:1; } }
            `;
            document.head.appendChild(style);
        }
        const overlay = document.createElement('div');
        overlay.className = 'broadcast-popup-overlay';
        overlay.innerHTML = `<div class="broadcast-popup-content"><h3>📢 Message from Admin</h3><p>${message}</p><button>Got it</button></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('button').onclick = () => overlay.remove();
        overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    }

    firebase.database().ref('config/broadcast').limitToLast(1).on('child_added', snap => {
        const broadcast = snap.val();
        if (!broadcast || !broadcast.timestamp) return;

        const lastSeen = sessionStorage.getItem('lastBroadcastTimestamp') || 0;
        if (broadcast.timestamp > lastSeen) {
            sessionStorage.setItem('lastBroadcastTimestamp', broadcast.timestamp);
            showBroadcastPopup(broadcast.message);
        }
    });
  
  user_name = localStorage.getItem("user_name");
  
  document.getElementById("user_name").innerHTML = "Welcome " + user_name + "!";
  
  function addRoom()
  {
    room_name = document.getElementById("room_name").value;
  
    firebase.database().ref("/").child(room_name).update({
      purpose : "adding room name"
    });
  
      localStorage.setItem("room_name", room_name);
      
      window.location = "ch.html";
  }
  
  function getData() {  firebase.database().ref("rooms").on('value', function(snapshot) { document.getElementById("output").innerHTML = ""; snapshot.forEach(function(childSnapshot) { childKey  = childSnapshot.key;
         Room_names = childKey;
         console.log("Room Name - " + Room_names);
        row = "<div class='room_name' id="+Room_names+" onclick='redirectToRoomName(this.id)' >#"+ Room_names +"</div><hr>";
        document.getElementById("output").innerHTML += row;
      });
    });
  
  }
  



  getData();
  






// Check if user is signed in
function checkLogin() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");

  // Randomly decide if we should prompt the user to log in
  if (!isLoggedIn && Math.random() < 100) { // 50% chance to ask for login
      promptLogin();
  }
}

// Function to prompt user to log in
function promptLogin() {
  if (confirm("You need to log in to access this site. Would you like to log in now?")) {
      window.location.href = "index.html"; // Redirect to your login page
  } else {
      // Optionally, redirect to an information page or close the site
      alert("You must log in to continue using the site.");
      window.location.href = "index.html"; // Or wherever you want to redirect
  }
}

// Call the checkLogin function on page load
checkLogin();










 // firebase.auth().onAuthStateChanged(function(user) {
  //  if (!user) {
        // No user is signed in, redirect to login page
    //    window.location.href = "index.html";
 //   } else {
        // User is signed in, proceed as normal
    //    user_name = user.displayName;
   //     document.getElementById("user_name").innerHTML = "Welcome " + user_name + "!";
 //   }
// });



  function redirectToRoomName(name)
  {
    console.log(name);
    localStorage.setItem("room_name", name);
      window.location = "ch.html";
  }
  
  function logout() {
  localStorage.removeItem("user_name");
  localStorage.removeItem("room_name");
      window.location = "index.html";
  }