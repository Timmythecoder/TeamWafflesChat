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
      
      window.location = "teamwaffleschatroom.html";
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
      window.location = "teamwaffleschatroom.html";
  }
  
  function logout() {
  localStorage.removeItem("user_name");
  localStorage.removeItem("room_name");
      window.location = "index.html";
  }