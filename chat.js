import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, push, onValue, get } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js"; 
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
let savedPassword = localStorage.getItem("room_password"); // Get stored password

// Function to check if the room is locked and validate the password
function checkRoomPassword() {
    const roomRef = ref(database, room_name);
    get(roomRef).then((snapshot) => {
        if (snapshot.exists()) {
            const roomData = snapshot.val();
            
            if (roomData.type === "private") {
                if (savedPassword === roomData.password) {
                    console.log("Password is correct, opening chat.");
                    openChat();  // Open the chat after successful password check
                } else {
                    alert("Incorrect password. Please try again.");
                    window.location.href = "dashboard.html";  // Redirect to home page or room selection page
                }
            } else {
                console.log("Room is public, opening chat.");
                openChat();  // No password required for public rooms
            }
        } else {
            console.log("Room not found in Firebase.");
            window.location.href = "index.html";  // Redirect to home page if room doesn't exist
        }
    }).catch((error) => {
        console.error("Error fetching room data:", error);
        alert("Error occurred. Please try again.");
    });
}

// Function to open the chat room
function openChat() {
    console.log("Opening chat for room:", room_name);
    getData();  // Fetch chat data as usual
}

// Call the checkRoomPassword function when the page loads
checkRoomPassword();

// Function to check notification permission & show banner
function checkNotificationPermission() {
    if (Notification.permission === "default") {
        Notification.requestPermission();
    } else if (Notification.permission !== "granted") {
        document.body.insertAdjacentHTML('afterbegin', '<div id="notif-banner" style="background:red;color:white;padding:5px;text-align:center;">Enable notifications for updates!</div>');
    }
}

// Call notification permission check on page load
checkNotificationPermission();

// Function to trigger a notification
function showNotification(message) {
    if (Notification.permission === "granted" && message) {
        new Notification("New message in Team Waffles!", {
            body: message,
            icon: "TWL O - Copy.png",
        });
    }
}

// Function to send a message with a 50-word limit
window.send = function() {
    let msg = document.getElementById("msg").value;
    let fileInput = document.getElementById("fileInput");
    let dateSent = new Date().toLocaleString();  // Get current date and time

    // Make sure user name is valid
    if (!user_name || !msg) {
        alert("Please provide a valid message and username.");
        return;
    }

    // Check word count (50 words limit)
    let wordCount = msg.split(/\s+/).length; // Split message by spaces and count words
    if (wordCount > 50) {
        alert("Message exceeds the 50-word limit.");
        return;
    }

    if (Notification.permission === "default") {
        Notification.requestPermission();
    }

    // Check if a file is selected
    if (fileInput.files.length > 0) {
        let file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) {  // File size check (5MB limit)
            alert("File size exceeds 5MB limit.");
            return;
        }
        let fileRef = storageRef(storage, 'files/' + file.name);
        uploadBytes(fileRef, file).then((snapshot) => {
            return getDownloadURL(fileRef);
        }).then((downloadURL) => {
            // Push data to Firebase with the file URL
            push(ref(database, room_name), {
                name: user_name,
                message: msg,
                fileURL: downloadURL,  // Store the file URL in Firebase
                dateSent: dateSent,
                like: 0,
                reactions: {}
            });
            document.getElementById("msg").value = "";  // Clear message input
            document.getElementById("fileInput").value = "";  // Clear file input
        });
    } else {
        // Push message data to Firebase without file
        push(ref(database, room_name), {
            name: user_name,
            message: msg,
            dateSent: dateSent,
            like: 0,
            reactions: {}
        });
        document.getElementById("msg").value = "";  // Clear message input
    }
};

// Function to trigger a notification for the latest message only
function notifyNewMessage(message, messageKey) {
    // Get the last notified message key from localStorage
    let lastNotifiedKey = localStorage.getItem("lastNotifiedKey");

    // If the current message key is different from the last notified key, send a notification
    if (messageKey !== lastNotifiedKey) {
        // Send notification if permission is granted
        if (Notification.permission === "granted") {
            new Notification("New message in Team Waffles!", {
                body: message,
                icon: "TWL O - Copy.png",
            });
            
            // Save the current message key to localStorage
            localStorage.setItem("lastNotifiedKey", messageKey);
        }
    }
}

// Retrieve and display chat data with notification logic
function getData() {
    onValue(ref(database, room_name), function(snapshot) {
        document.getElementById("output").innerHTML = "";  // Clear previous output

        let lastMessageKey = "";  // Track the latest message key

        snapshot.forEach(function(childSnapshot) {
            let childData = childSnapshot.val();  // Get message data
            let messageKey = childSnapshot.key;  // Get message key

            // Log the message data to debug
            console.log(childData);

            // Check if the data is valid and display it
            if (childData && childData.name && childData.message) {
                // Display message in chat
                let row = `<div>
                            <h4>${childData.name} <img class='user_tick' src='TWL O.png'></h4>
                            <p>${childData.message}</p>
                            ${childData.fileURL ? `<a href="${childData.fileURL}" target="_blank">Download file</a>` : ""}
                            <p><span class='time_date'>${childData.dateSent}</span></p>
                            <button class="btn btn-warning" id="${childSnapshot.key}" onclick="updateLike('${childSnapshot.key}')">Like: ${childData.like}</button>
                        </div><hr>`;
                document.getElementById("output").innerHTML += row;

                // Track the latest message key
                lastMessageKey = messageKey;
            } else {
                console.log("Invalid data received from Firebase:", childData);
            }
        });

        // Trigger notification for the latest message if needed
        if (lastMessageKey) {
            let latestMessageData = snapshot.child(lastMessageKey).val();
            if (latestMessageData) {
                notifyNewMessage(latestMessageData.message, lastMessageKey);
            }
        }
    });
}

getData();
