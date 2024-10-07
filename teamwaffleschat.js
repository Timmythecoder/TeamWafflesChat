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
  
  user_name = localStorage.getItem("user_name");
  
  document.getElementById("user_name").innerHTML = "Welcome " + user_name + "!";
  
  function addRoom()
  {
    room_name = document.getElementById("room_name").value;
  
    firebase.database().ref("/").child(room_name).update({
      purpose : "adding room name"
    });
  
      localStorage.setItem("room_name", room_name);
      
      window.location = "chat.html";
  }
  
  function getData() {  firebase.database().ref("/").on('value', function(snapshot) { document.getElementById("output").innerHTML = ""; snapshot.forEach(function(childSnapshot) { childKey  = childSnapshot.key;
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
      window.location = "chat.html";
  }
  
  function logout() {
  localStorage.removeItem("user_name");
  localStorage.removeItem("room_name");
      window.location = "index.html";
  }