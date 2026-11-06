'use strict';
/**
 * Firebase Firestore İstemci Yapılandırması
 * Zerda Koçkaya — Google Cloud Firestore Veritabanı
 */
const firebaseConfig = {
  projectId: "zerda-kockaya-salon",
  appId: "1:855291211898:web:bdbd9247cb73ca3dfc0bc3",
  storageBucket: "zerda-kockaya-salon.firebasestorage.app",
  apiKey: "AIzaSyCOsnhvE6iIA5glR6dF-q_IO22Nxl5zUQM",
  authDomain: "zerda-kockaya-salon.firebaseapp.com",
  messagingSenderId: "855291211898",
  projectNumber: "855291211898"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
const NOTIFY_EMAIL = 'arjin.c508@gmail.com';
