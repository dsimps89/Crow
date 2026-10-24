# City Signal: shared real-time voting

## Set up Firebase
1. Create a Firebase project at https://console.firebase.google.com/ (billing may be required for Cloud Functions).
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create **Cloud Firestore** in production mode.
4. Open **Project settings → Your apps → Web app** and copy the Firebase config values into `public/index.html` (also into root `index.html` if you use it separately). Do not change the Cloud Functions region unless you also update the client.
5. Install Node.js and Firebase CLI. From this project directory run `npm install`, `cd functions && npm install && cd ..`, then `npx firebase login`, `npx firebase use --add`, `npx firebase deploy`.
6. Open the Firebase Hosting URL after deployment. Opening the HTML from disk is not a supported deployment; Firebase Authentication requires an authorized domain.
7. Enable **Firestore TTL** on collection group `votes`, timestamp field `expiresAt`. TTL cleanup is asynchronous, not guaranteed at the exact 24-hour mark. The input snapshot remains in `votes` until deletion. Public totals are retained by weekly cycle; past cycles are not automatically deleted.
8. Consider enabling Firebase App Check, abuse monitoring, and quotas before promoting the site. Anonymous authentication does not enforce one vote per human, and clearing browser data can create another account.

## Behavior
- Each click on a stage sends one authenticated request to `castVote` Cloud Function.
- A Firestore transaction enforces a 24-hour lock per anonymous user ID and atomically increments the current weekly aggregate.
- Every browser subscribes to the shared aggregate via a Firestore real-time listener.
- The weekly cycle is defined by the most recent Friday 8 PM in `America/Toronto`. At that moment the UI subscribes to the new cycle with zero totals; no deletion job is required to reset displayed results.
- Input sliders can be changed freely and do not submit votes. A vote stores a snapshot with a 24-hour expiration timestamp.
- Firestore security rules make voter and individual vote records unreadable to browsers; only aggregates are public.
- Counts are **votes**, not observed attendance. Capacity and occupancy inputs are illustrative.

## Important limits
The code has been syntax-checked but cannot be connected to your Firebase project until you supply its configuration and deploy it. Firebase pricing and plan requirements are controlled by Google. Firebase config values are public client identifiers, not secrets. Do not put Firebase Admin private keys in the HTML.
