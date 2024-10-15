import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onValue, update, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js"; 
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);
const auth = getAuth(app);

// User and room names
let user_name = localStorage.getItem("user_name");
let room_name = localStorage.getItem("room_name");

// Sign in the user anonymously
signInAnonymously(auth)
    .then((userCredential) => {
        console.log("User signed in:", userCredential.user.uid);
    })
    .catch((error) => {
        console.error("Error signing in:", error);
    });

// Check if user is signed in
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("User is signed in:", user.uid);
    } else {
        console.log("No user is signed in.");
    }
});

// Function to check notification permission
function checkNotificationPermission() {
    if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                console.log("Notification permission granted.");
            } else {
                console.log("Notification permission denied.");
            }
        });
    } else if (Notification.permission === "granted") {
        console.log("Notifications already granted.");
    } else {
        console.log("Notifications denied.");
    }
}

// Call notification permission check on page load
checkNotificationPermission();

// Function to trigger a notification
function showNotification(message) {
    if (Notification.permission === "granted") {
        new Notification("New message in Team Waffles!", {
            body: message,
            icon: "TWL O - Copy.png", // Replace with your own icon URL
        });
    }
}

// Function to format time as "7:20pm"
function formatTime(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // Adjust 0 hour to 12
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutes}${ampm}`;
}

// Function to format date as "Tuesday, 3, 3:28pm"
function formatDate(date) {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[date.getDay()];
    const dayNumber = date.getDate();
    const timeString = formatTime(date);
    return `${dayName}, ${dayNumber}, ${timeString}`;
}

// Function to send a message
window.send = function() {
    let msg = document.getElementById("msg").value;
    let fileInput = document.getElementById("fileInput");
    let dateSent = formatDate(new Date());

    if (fileInput.files.length > 0) {
        let file = fileInput.files[0];

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert("File size exceeds 5MB limit. Please upload a smaller file.");
            return;
        }

        let fileRef = storageRef(storage, 'files/' + file.name);

        uploadBytes(fileRef, file).then((snapshot) => {
            console.log("File uploaded successfully!");
            return getDownloadURL(fileRef);
        }).then((downloadURL) => {
            // Send message along with file URL
            push(ref(database, room_name), {
                name: user_name,
                message: msg,
                fileURL: downloadURL,
                dateSent: dateSent,
                like: 0, // Initialize like count
                reactions: {} // Initialize reactions here
            });
            document.getElementById("msg").value = "";
            document.getElementById("fileInput").value = "";

            // Trigger notification
            showNotification(msg);
        }).catch((error) => {
            console.error("Error uploading file: ", error);
        });
    } else {
        // If no file is selected, just send the message
        push(ref(database, room_name), {
            name: user_name,
            message: msg,
            dateSent: dateSent,
            like: 0, // Initialize like count
            reactions: {} // Initialize reactions here
        });
        document.getElementById("msg").value = "";

        // Trigger notification
        showNotification(msg);
    }
};

// Function to update likes
window.updateLike = function(messageId) {
    const messageRef = ref(database, `${room_name}/${messageId}`);

    onValue(messageRef, (snapshot) => {
        if (snapshot.exists()) {
            const messageData = snapshot.val();
            const currentLikes = messageData.like || 0;

            // Update like count
            update(messageRef, {
                like: currentLikes + 1
            }).catch((error) => {
                console.error("Error updating likes: ", error);
            });
        }
    }, {
        onlyOnce: true // Fetch data only once
    });
};

// Function to add reactions
window.addReaction = function(messageId, emoji) {
    const messageRef = ref(database, `${room_name}/${messageId}`);

    get(messageRef).then((snapshot) => {
        if (snapshot.exists()) {
            const messageData = snapshot.val();
            const currentReactions = messageData.reactions || {};

            // Update reactions to increment by 1 for this emoji
            const updatedReactions = {
                ...currentReactions,
                [emoji]: (currentReactions[emoji] || 0) + 1 // Increment reaction count
            };

            // Update the database with the new reactions count
            update(messageRef, { reactions: updatedReactions })
                .then(() => {
                    console.log(`Reaction added: ${emoji} for message ID: ${messageId}`);
                })
                .catch((error) => {
                    console.error("Error updating reactions: ", error);
                });
        }
    }).catch((error) => {
        console.error("Error getting message data: ", error);
    });
};

// Function to retrieve and display chat data
function getData() {
    onValue(ref(database, room_name), function(snapshot) {
        document.getElementById("output").innerHTML = ""; // Clear previous output
        snapshot.forEach(function(childSnapshot) {
            let childKey = childSnapshot.key;
            let childData = childSnapshot.val();

            let messageText = childData.message || "";
            let fileURL = childData.fileURL || "";
            let userName = childData.name || "Unknown";
            let likeCount = childData.like || 0;
            let dateSent = childData.dateSent || "";
            let reactions = childData.reactions || {};

            let row = `<div>
                            <h4>${userName} <img class='user_tick' src='TWL O.png'></h4>
                            <p>${messageText}</p>
                            ${fileURL ? `<a href="${fileURL}" target="_blank">Download file</a>` : ""}
                            <p><span class='time_date'>${dateSent}</span></p>
                            <button class="btn btn-warning" id="${childKey}" value="${likeCount}" onclick="updateLike(this.id)">
                                Like: ${likeCount}
                            </button>
                            <div class="reaction-buttons">
                                <button onclick="addReaction('${childKey}', '👍')">👍</button>
                                <button onclick="addReaction('${childKey}', '❤️')">❤️</button>
                                <button onclick="addReaction('${childKey}', '😂')">😂</button>
                                <button onclick="addReaction('${childKey}', '😲')">😲</button>
                                <button onclick="addReaction('${childKey}', '😢')">😢</button>
                            </div>
                            <div class="reaction-counts">
                                <span id="reaction-count-${childKey}-👍">${reactions["👍"] || 0}</span> 👍
                                <span id="reaction-count-${childKey}-❤️">${reactions["❤️"] || 0}</span> ❤️
                                <span id="reaction-count-${childKey}-😂">${reactions["😂"] || 0}</span> 😂
                                <span id="reaction-count-${childKey}-😲">${reactions["😲"] || 0}</span> 😲
                                <span id="reaction-count-${childKey}-😢">${reactions["😢"] || 0}</span> 😢
                            </div>
                        </div><hr>`;
            document.getElementById("output").innerHTML += row;
        });
    });
}

// Call the getData function to retrieve chat data on page load
getData();
