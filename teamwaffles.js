
function addUser() {

    user_name = document.getElementById("user_name").value;
  
    localStorage.setItem("user_name", user_name);
    
      window.location = "teamwafflesroomselector.html";
  }
  



// Check if user is signed in
function checkLogin() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");

  // Randomly decide if we should prompt the user to log in
  if (!isLoggedIn && Math.random() < 0.5) { // 50% chance to ask for login
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



