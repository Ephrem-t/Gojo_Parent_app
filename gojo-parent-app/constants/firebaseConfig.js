// constants/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your Firebase config here
const firebaseConfig = {
  apiKey: "AIzaSyAWqqYqPluS9UnaoPZOlpvwhRYYii3kM3w",
  authDomain: "ethiostore-17d9f.firebaseapp.com",
  databaseURL: "https://ethiostore-17d9f-default-rtdb.firebaseio.com",
  projectId: "ethiostore-17d9f",
  storageBucket: "ethiostore-17d9f.appspot.com",
  messagingSenderId: "1041052914588",
  appId: "1:1041052914588:web:7736dc3479c2dadc266e59",
  measurementId: "G-STP74SEGDC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const database = getDatabase(app);
