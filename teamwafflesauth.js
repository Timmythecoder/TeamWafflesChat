// -------------------- Firebase Config --------------------
var firebaseConfig = {
  apiKey: "AIzaSyCfTDFXdh1tifQIyY6415IORbdXIffYUJ4",
  authDomain: "team-waffles.firebaseapp.com",
  databaseURL: "https://team-waffles-default-rtdb.firebaseio.com",
  projectId: "team-waffles",
  storageBucket: "team-waffles.appspot.com",
  messagingSenderId: "891460090478",
  appId: "1:891460090478:web:c01b6db1af21745769047f",
  measurementId: "G-D9ZY0SVXBN"
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

// -------------------- Global State --------------------
let isSignUp = false;

// -------------------- Form Toggle --------------------
function toggleForm() {
  isSignUp = !isSignUp;
  if (isSignUp) {
    document.getElementById('form-title').innerText = "Sign Up";
    document.getElementById('auth-button').innerText = "Sign Up";
    document.getElementById('toggle-text').innerHTML = `Already have an account? <a href="#" onclick="toggleForm()">Sign In</a>`;
  } else {
    document.getElementById('form-title').innerText = "Sign In";
    document.getElementById('auth-button').innerText = "Sign In";
    document.getElementById('toggle-text').innerHTML = `Don't have an account? <a href="#" onclick="toggleForm()">Sign Up</a>`;
  }
}

// -------------------- Auth Action --------------------
function authAction() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMessageElement = document.getElementById('error-message');
  const successMessageElement = document.getElementById('success-message');
  const loadingSpinner = document.getElementById('loading-spinner');

  errorMessageElement.innerText = '';
  successMessageElement.innerText = '';

  // ✅ reCAPTCHA validation check
  const captchaResponse = grecaptcha.getResponse();
  if (captchaResponse.length === 0) {
    errorMessageElement.innerText = "Please complete the reCAPTCHA before continuing.";
    return; // Stop here if captcha not solved
  }

  loadingSpinner.style.display = 'block';

  if (isSignUp) {
    // -------------------- Sign Up --------------------
    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        if (userCredential && userCredential.user) {
          const user = userCredential.user;
          user.sendEmailVerification()
            .then(() => showVerificationPopup())
            .catch((error) => {
              console.error("Error sending verification email: ", error.message);
              errorMessageElement.innerText = "Failed to send verification email.";
            });

          saveUserToDatabase(user.uid, email);
          successMessageElement.innerText = "Sign up successful! Please verify your email. Switching to login...";
          toggleForm(); // Auto-switch to Sign In mode
          document.getElementById('password').value = ""; // Clear password field
        }
      })
      .catch((error) => {
        console.error("Error during signup: ", error.message);
        displayErrorMessage(error, errorMessageElement);
      })
      .finally(() => {
        loadingSpinner.style.display = 'none';
        grecaptcha.reset(); // reset captcha after submit
      });

  } else {
    // -------------------- Sign In --------------------
    firebase.auth().signInWithEmailAndPassword(email, password)
      .then((userCredential) => {
        if (userCredential && userCredential.user) {
          const user = userCredential.user;

          if (!user.emailVerified) {
            errorMessageElement.innerText = "Please verify your email before logging in.";
            firebase.auth().signOut();
            showVerificationPopup();
            return;
          }

          const userRef = firebase.database().ref('users/' + user.uid);
          userRef.once('value').then((snapshot) => {
            if (!snapshot.exists()) {
              saveUserToDatabase(user.uid, user.email);
            }

            successMessageElement.innerText = "Login successful!";
            localStorage.setItem("isLoggedIn", true);
            window.location = "dashboard.html";
          }).catch((error) => {
            console.error("Error checking user node:", error.message);
            displayErrorMessage(error, errorMessageElement);
          });
        }
      })
      .catch((error) => {
        console.error("Error during login: ", error.message);
        displayErrorMessage(error, errorMessageElement);
      })
      .finally(() => {
        loadingSpinner.style.display = 'none';
        grecaptcha.reset(); // reset captcha after login attempt
      });
  }
}

// -------------------- Database Helper --------------------
function saveUserToDatabase(userId, email) {
  if (!userId) {
    console.error("No UID available for saving user.");
    return;
  }

  const defaultSettings = {
    email: email,
    notifications: true,
    displayName: "",
    joined: new Date().toISOString()
  };

  firebase.database().ref('users/' + userId).set(defaultSettings)
    .then(() => console.log("User saved to database"))
    .catch(error => console.error("Error saving user to database:", error.message));
}

// -------------------- UI Helpers --------------------
function showVerificationPopup() {
  const popup = document.createElement("div");
  popup.classList.add("verification-popup");
  popup.innerHTML = `
    <div class="popup-content">
        <h3>Email Verification Required</h3>
        <p>Please check your inbox/spam and verify your email before logging in.</p>
        <button onclick="closePopup()">OK</button>
    </div>
  `;
  document.body.appendChild(popup);
}

function closePopup() {
  const popup = document.querySelector(".verification-popup");
  if (popup) popup.remove();
}

function displayErrorMessage(error, element) {
  let msg = "An error occurred. Please try again.";
  if (error.code === "auth/invalid-email") msg = "Invalid email address.";
  else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") msg = "Invalid login credentials.";
  else if (error.message.includes("INVALID_LOGIN_CREDENTIALS")) msg = "Invalid login credentials.";
  element.innerText = msg;
}

function getUserFromDatabase(userId) {
  if (!userId) {
    console.error("No UID available for fetching user.");
    return;
  }
  return firebase.database().ref('users/' + userId).once('value').then(snapshot => snapshot.val())
    .catch(error => console.error("Error fetching user data: ", error.message));
}

// -------------------- Auto Auth Check --------------------
firebase.auth().onAuthStateChanged(function(user) {
  if (user && user.emailVerified) {
    console.log("Verified user already logged in:", user.email);
    firebase.database().ref('users/' + user.uid).once('value').then((snapshot) => {
      if (!snapshot.exists()) {
        saveUserToDatabase(user.uid, user.email);
      }
      localStorage.setItem("isLoggedIn", true);
      window.location = "dashboard.html";
    });
  } else {
    console.log("User not logged in or not verified.");
    firebase.auth().signOut();
    localStorage.removeItem("isLoggedIn");
  }
});









// -------------------- Google Sign-In --------------------
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();

  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      const user = result.user;

      if (user) {
        // Save user info if new
        const userRef = firebase.database().ref('users/' + user.uid);
        userRef.once('value').then((snapshot) => {
          if (!snapshot.exists()) {
            saveUserToDatabase(user.uid, user.email);
          }
          localStorage.setItem("isLoggedIn", true);
          window.location = "dashboard.html";
        });
      }
    })
    .catch((error) => {
      console.error("Google Sign-In Error:", error.message);
      document.getElementById('error-message').innerText =
        "Google Sign-In failed: " + error.message;
    });
}

// -------------------- Forgot Password --------------------
function forgotPassword() {
  const email = document.getElementById('email').value.trim();
  const errorMessageElement = document.getElementById('error-message');
  const successMessageElement = document.getElementById('success-message');
  const loadingSpinner = document.getElementById('loading-spinner');

  if (!email) {
    errorMessageElement.innerText = "Please enter your email address in the email field above to reset your password.";
    return;
  }

  // Show loading GIF
  loadingSpinner.innerHTML = '<img src="LOADING2.gif" alt="Loading..." style="width: 500px; height: 300px;">';
  loadingSpinner.style.display = 'block';

  firebase.auth().sendPasswordResetEmail(email)
    .then(() => {
      successMessageElement.innerText = "Password reset email sent to " + email;
      errorMessageElement.innerText = "";
    })
    .catch((error) => {
      errorMessageElement.innerText = error.message;
      successMessageElement.innerText = "";
    })
    .finally(() => {
      loadingSpinner.style.display = 'none';
      // Restore original loading video if needed for other actions
      loadingSpinner.innerHTML = `<video autoplay loop muted onplay="this.playbackRate=2.0">
                <source src="Loading.mp4" type="video/mp4"> 
                Your browser does not support the video tag.
            </video>`;
    });
}
