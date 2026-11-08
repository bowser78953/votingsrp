const firebaseConfig = {
  apiKey: "AIzaSyArX8qgl66Qj8G2aGo0MaWD4LNZA51YxR0",
  authDomain: "srpvoting.firebaseapp.com",
  projectId: "srpvoting",
  storageBucket: "srpvoting.firebasestorage.app",
  messagingSenderId: "162419453144",
  appId: "1:162419453144:web:3ac355598bcc8dc7c4fbad"
};

window.SRP_FIREBASE_READY = (async () => {
  try {
    const sdkUrl = "https://www.gstatic.com/firebasejs/13.2.0/";
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import(sdkUrl + "firebase-app.js"),
      import(sdkUrl + "firebase-auth.js"),
      import(sdkUrl + "firebase-firestore.js")
    ]);
    const app = appSdk.initializeApp(firebaseConfig);
    const services = {
      auth: authSdk.getAuth(app),
      db: firestoreSdk.getFirestore(app),
      GoogleAuthProvider: authSdk.GoogleAuthProvider,
      signInWithPopup: authSdk.signInWithPopup,
      onAuthStateChanged: authSdk.onAuthStateChanged,
      signOut: authSdk.signOut,
      collection: firestoreSdk.collection,
      doc: firestoreSdk.doc,
      getDoc: firestoreSdk.getDoc,
      getCountFromServer: firestoreSdk.getCountFromServer,
      onSnapshot: firestoreSdk.onSnapshot,
      runTransaction: firestoreSdk.runTransaction,
      serverTimestamp: firestoreSdk.serverTimestamp,
      setDoc: firestoreSdk.setDoc
    };
    window.SRP_FIREBASE = services;
    window.dispatchEvent(new Event("srp-firebase-ready"));
    return services;
  } catch (error) {
    window.SRP_FIREBASE_ERROR = error;
    window.dispatchEvent(new Event("srp-firebase-error"));
    throw error;
  }
})();
