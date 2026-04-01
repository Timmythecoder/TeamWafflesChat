// --- Firebase Config ---
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
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

let isSignUp = false;
let pendingData = { email: '', password: '' };

// --- State Persistence ---
function setAuthStep(step) {
    if (step) localStorage.setItem('tw_step', step);
    else localStorage.removeItem('tw_step');
}

window.onload = () => {
    const step = localStorage.getItem('tw_step');
    if (step === 'verifying') document.getElementById('verifyEmailModal').classList.add('active');
    if (step === 'setup') document.getElementById('setupAccountModal').classList.add('active');
};

// --- Form Toggle ---
function toggleForm() {
    const ov = document.getElementById('transition-overlay');
    ov.innerText = isSignUp ? "Switching to Sign In..." : "Switching to Sign Up...";
    ov.classList.remove('flash-animation');
    void ov.offsetWidth; ov.classList.add('flash-animation');

    setTimeout(() => {
        isSignUp = !isSignUp;
        document.getElementById('form-title').innerText = isSignUp ? "Create Account" : "Sign In";
        document.getElementById('auth-button').innerText = isSignUp ? "Register" : "Sign In";
        document.getElementById('toggle-text').innerHTML = isSignUp ? 
            `Already a member? <a href="#" onclick="toggleForm()">Sign In</a>` : 
            `Don't have an account? <a href="#" onclick="toggleForm()">Sign Up</a>`;
    }, 300);
}

// --- Auth Actions ---
function authAction() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (grecaptcha.getResponse().length === 0) return alert("Complete Captcha");

    if (isSignUp) {
        pendingData = { email, password };
        document.getElementById('confirmSignupModal').classList.add('active');
    } else {
        performLogin(email, password);
    }
}

function executeFinalSignup() {
    document.getElementById('confirmSignupModal').classList.remove('active');
    document.getElementById('loading-spinner').style.display = 'block';

    firebase.auth().createUserWithEmailAndPassword(pendingData.email, pendingData.password)
        .then(cred => {
            cred.user.sendEmailVerification();
            saveUserNode(cred.user.uid, pendingData.email);
            setAuthStep('verifying');
            document.getElementById('verifyEmailModal').classList.add('active');
        })
        .catch(err => alert(err.message))
        .finally(() => document.getElementById('loading-spinner').style.display = 'none');
}

function performLogin(email, password) {
    document.getElementById('loading-spinner').style.display = 'block';
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(cred => {
            if (!cred.user.emailVerified) {
                setAuthStep('verifying');
                document.getElementById('verifyEmailModal').classList.add('active');
                firebase.auth().signOut();
            } else {
                checkUserData(cred.user);
            }
        })
        .catch(err => alert(err.message))
        .finally(() => document.getElementById('loading-spinner').style.display = 'none');
}

// --- Data Flow ---
function checkUserData(user) {
    firebase.database().ref('users/' + user.uid).once('value').then(snap => {
        const data = snap.val() || {};
        if (!data.permanentUsername) {
            setAuthStep('setup');
            document.getElementById('setupAccountModal').classList.add('active');
        } else {
            setAuthStep(null);
            localStorage.setItem("isLoggedIn", true);
            window.location.href = "dashboard.html";
        }
    });
}

function saveUserNode(uid, email) {
    firebase.database().ref('users/' + uid).set({
        email: email,
        joined: new Date().toISOString()
    });
}

async function saveInitialSetup() {
    const user = firebase.auth().currentUser;
    const perm = document.getElementById('newPermUser').value.trim().replace(/\s/g, '');
    const disp = document.getElementById('newDisplayName').value.trim();

    if (perm.length < 3) return alert("Username too short");

    await firebase.database().ref('users/' + user.uid).update({
        permanentUsername: perm,
        displayName: disp
    });
    setAuthStep(null);
    window.location.href = "dashboard.html";
}

// --- Utility ---
function resetAuthFlow() {
    firebase.auth().signOut();
    setAuthStep(null);
    location.reload();
}

async function checkVerificationStatus() {
    const user = firebase.auth().currentUser;
    if (user) {
        await user.reload();
        if (user.emailVerified) {
            document.getElementById('verifyEmailModal').classList.remove('active');
            checkUserData(user);
        } else alert("Not verified yet");
    }
}

function closeConfirmModal() { document.getElementById('confirmSignupModal').classList.remove('active'); }

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(res => checkUserData(res.user));
}

firebase.auth().onAuthStateChanged(u => { if(u && u.emailVerified) checkUserData(u); });