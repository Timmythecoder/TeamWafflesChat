const auth = firebase.auth();
const db = firebase.database();




async function addUser() {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to set a username.");
    return;
  }
  
  const uid = user.uid;
  const user_name = document.getElementById("user_name").value.trim();

  if (!user_name) {
    alert("Please enter a username.");
    return;
  }

  // Check if username already exists in DB for this user
  const userRef = db.ref("users/" + uid);

  try {
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    if (userData && userData.permanentUsername) {
      // Username already set, don't allow changing it
      alert("Your permanent username is already set and cannot be changed.");
      // Optionally redirect anyway
      window.location = "teamwafflesroomselector.html";
      return;
    }

    // Save permanent username to Firebase DB (only once)
    await userRef.update({
      permanentUsername: user_name
    });

    // Save username locally for quick access
    localStorage.setItem("user_name", user_name);
    localStorage.setItem("isLoggedIn", "true"); // Optional: mark as logged in locally

    // Redirect to next page
    window.location = "teamwafflesroomselector.html";

  } catch (error) {
    console.error("Error setting username:", error);
    alert("Failed to set username. Please try again.");
  }
}

  



function checkLogin() {
  const user = auth.currentUser;
  const isLoggedIn = localStorage.getItem("isLoggedIn");

  if (!user) {
    // User not logged in by Firebase auth
    if (!isLoggedIn && Math.random() < 0.5) { // 50% chance to prompt login
      promptLogin();
    }
  }
}

function promptLogin() {
  if (confirm("You need to log in to access this site. Would you like to log in now?")) {
    window.location.href = "index.html"; // your login page
  } else {
    alert("You must log in to continue using the site.");
    window.location.href = "index.html"; // or redirect somewhere else
  }
}

window.onload = () => {
  checkLogin();
};
