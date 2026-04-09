import { initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref } from "firebase/storage";

const app = initializeApp({
  apiKey: "AIzaSyCXMU6x1UQpsLM9q11j6am6lj6zx9DtqB8",
  authDomain: "gojo-education.firebaseapp.com",
  databaseURL: "https://gojo-education-default-rtdb.firebaseio.com",
  projectId: "gojo-education",
  storageBucket: "gojo-education.firebasestorage.app",
  messagingSenderId: "579247228743",
  appId: "1:579247228743:web:09eb812cc3ee8a516f2e62",
});

const storages = [
  { label: "firebasestorage", storage: getStorage(app) },
  { label: "appspot", storage: getStorage(app, "gs://gojo-education.appspot.com") },
  { label: "bale-house-rental", storage: getStorage(app, "gs://bale-house-rental.appspot.com") },
];
const paths = [
  "Management/GMIA_0001_26_1774593134_profile.PNG",
  "HR/Posts/-OoioIOb7qwe0EOuTgVe_1775549130_post.PNG",
  "HR/GMIH_0001_26_1774606946_profile.jpg",
];

for (const { label, storage } of storages) {
  for (const objectPath of paths) {
    try {
      const downloadUrl = await getDownloadURL(ref(storage, objectPath));
      console.log(`OK\t${label}\t${objectPath}\t${downloadUrl}`);
    } catch (error) {
      console.log(
        `ERR\t${label}\t${objectPath}\t${error?.code || "unknown"}\t${error?.message || String(error)}\t${error?.serverResponse || error?.customData?.serverResponse || ""}`
      );
    }
  }
}