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
          successMessageElement.innerText = "Sign up successful! Please verify your email.";
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
        <p>Please check your inbox and verify your email before logging in.</p>
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
