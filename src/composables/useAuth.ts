import { ref, readonly } from "vue";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "../services/firebaseService";
import {
  migrateLocalStorage,
  initCloudSync,
  stopCloudSync,
} from "../services/cloudSyncService";

const user = ref<User | null>(null);
const isLoadingAuth = ref(true);

// Wire up the Firebase auth listener once at module level (singleton)
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    user.value = firebaseUser;
    // Migrate any existing localStorage data, then start real-time sync
    await migrateLocalStorage(firebaseUser.uid);
    initCloudSync(firebaseUser.uid);
  } else {
    user.value = null;
    stopCloudSync();
  }
  isLoadingAuth.value = false;
});

export function useAuth() {
  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
    // onAuthStateChanged above handles the rest
  }

  async function signOut() {
    await firebaseSignOut(auth);
    // onAuthStateChanged sets user.value = null
  }

  return {
    user: readonly(user),
    isLoadingAuth: readonly(isLoadingAuth),
    signInWithGoogle,
    signOut,
  };
}
