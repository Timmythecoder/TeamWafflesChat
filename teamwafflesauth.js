// Firebase config (replace with your actual config)
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

let isSignUp = false; // Tracks the current form state (sign in or sign up)

// Toggle between login and signup forms
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

// Handle authentication action (login or signup)
function authAction() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (isSignUp) {
        // Sign up new user
        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                if (userCredential && userCredential.user) {
                    const user = userCredential.user;
                    saveUserToDatabase(user.uid, email);
                    alert("Sign up successful!");
                    localStorage.setItem("isLoggedIn", true);
                    window.location = "auth.html"; // Redirect after successful sign up
                }
            })
            .catch((error) => {
                console.error("Error during signup: ", error.message);
                alert("Error: " + error.message);
            });
    } else {
        // Log in existing user
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                if (userCredential && userCredential.user) {
                    const user = userCredential.user;
                    getUserFromDatabase(user.uid).then((userData) => {
                        console.log("User Data: ", userData);
                        alert("Login successful!");
                        localStorage.setItem("isLoggedIn", true);
                        window.location = "auth.html"; // Redirect after successful login
                    });
                }
            })
            .catch((error) => {
                console.error("Error during login: ", error.message);
                alert("Error: " + error.message);
            });
    }
}





const auth = getAuth(app);

// Check if the user is already signed in
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is signed in:", user.uid);
    } else {
        // Sign in the user anonymously
        signInAnonymously(auth)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("User signed in:", user.uid);
            })
            .catch((error) => {
                console.error("Error signing in:", error);
            });
    }
});








// Save user to Firebase Realtime Database
function saveUserToDatabase(userId, email) {
    if (!userId) {
        console.error("No UID available for saving user.");
        return;
    }
    firebase.database().ref('users/' + userId).set({
        email: email
    }).then(() => {
        console.log("User saved to database");
    }).catch((error) => {
        console.error("Error saving user to database: ", error.message);
    });
}

// Fetch user data from Firebase Realtime Database
function getUserFromDatabase(userId) {
    if (!userId) {
        console.error("No UID available for fetching user.");
        return;
    }
    return firebase.database().ref('users/' + userId).once('value').then((snapshot) => {
        return snapshot.val(); // Return the user data
    }).catch((error) => {
        console.error("Error fetching user data: ", error.message);
    });
}

// Check if a user is already logged in
firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        console.log("User already logged in: ", user.email);
        // Optionally, redirect to the main page if the user is already logged in
        // window.location = "teamwafflesroomselector.html";
    }
});
