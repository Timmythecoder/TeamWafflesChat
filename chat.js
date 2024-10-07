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











function goBack() {
    window.location.href = 'teamwafflesroomselector.html'; // Redirects to the specified page
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

// Function to update the reaction count displayed in the UI
function updateReactionCount(messageId, emoji) {
    const countElement = document.getElementById(`reaction-count-${messageId}-${emoji}`);
    if (countElement) {
        let currentCount = parseInt(countElement.innerText) || 0;
        countElement.innerText = currentCount + 1; // Increment by 1
    }
}

// Function to send a message
window.send = function() {
    let msg = document.getElementById("msg").value;
    let fileInput = document.getElementById("fileInput");
    let dateSent = formatDate(new Date()); // Updated to use the new formatDate function

    if (fileInput.files.length > 0) {
        let file = fileInput.files[0];
        let fileRef = storageRef(storage, 'files/' + file.name);

        uploadBytes(fileRef, file).then((snapshot) => {
            console.log("File uploaded successfully!");
            return getDownloadURL(fileRef);
        }).then((downloadURL) => {
            // Send message along with file URL and initialize reactions
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
let pendingReactions = {};
let reactionTimeouts = {};
const REACTION_UPDATE_DELAY = 1000; // Adjust the delay as needed

window.addReaction = function(messageId, emoji) {
    const messageRef = ref(database, `${room_name}/${messageId}`);

    get(messageRef).then((snapshot) => {
        if (snapshot.exists()) {
            const messageData = snapshot.val();
            const currentReactions = messageData.reactions || {};

            // Check if the emoji has already been reacted
            const currentCount = currentReactions[emoji] || 0;

            // Update reactions to increment by 1 for this emoji
            const updatedReactions = {
                ...currentReactions,
                [emoji]: currentCount + 1 // Increment reaction count
            };

            // Update the database with the new reactions count
            update(messageRef, { reactions: updatedReactions })
                .then(() => {
                    console.log(`Reaction added: ${emoji} for message ID: ${messageId}`);
                    // Optionally update the UI for immediate feedback
                    updateReactionCount(messageId, emoji);
                })
                .catch((error) => {
                    console.error("Error updating reactions: ", error);
                });
        }
    }).catch((error) => {
        console.error("Error getting message data: ", error);
    });
};

function getData() {
    onValue(ref(database, room_name), function(snapshot) {
        document.getElementById("output").innerHTML = ""; // Clear previous output
        snapshot.forEach(function(childSnapshot) {
            let childKey = childSnapshot.key;
            let message_data = childSnapshot.val();
            if (childKey !== "purpose") {
                let firebase_message_id = childKey;
                let name = message_data['name'];
                let message = message_data['message'];
                let like = message_data['like'] || 0;
                let dateSent = message_data['dateSent'];
                let reactions = message_data['reactions'] || {};
                let fileURL = message_data['fileURL']; // Get file URL

                // Create message HTML
                let row = `
                    <h4>${name}</h4>
                    <h4 class='message_h4'>${message}</h4>
                    <h5 class='date_sent'>${dateSent}</h5>
                    <button class='btn btn-warning' id="${firebase_message_id}" onclick='updateLike(this.id)'>Like: ${like}</button>
                `;

                // Add file link if it exists
                if (fileURL) {
                    row += `<a href="${fileURL}" target="_blank">View File</a>`;
                }

                // Add reactions
                row += `<div class="reactions">`;
                const emojis = ['👍', '❤️', '😂', '😢', '😡']; // Define the emojis to be used
                emojis.forEach(emoji => {
                    let count = reactions[emoji] || 0;
                    row += `
                        <span id="reaction-count-${firebase_message_id}-${emoji}">${count}</span> ${emoji}
                        <button onclick="addReaction('${firebase_message_id}', '${emoji}')">React</button>
                    `;
                });
                row += `</div>`;

                // Append to output
                document.getElementById("output").innerHTML += row + "<hr>";
            }
        });
    });
}

// Call the function to retrieve messages on page load
getData();

