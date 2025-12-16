import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

export interface UserProfile {
  username: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  createdAt: string;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Sign up with email and password
export const signUpWithEmail = async (
  email: string, 
  password: string, 
  username: string,
  fullName: string, 
  dateOfBirth: string
): Promise<User> => {
  try {
    console.log('[Firebase] Attempting to create user with email:', email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log('[Firebase] User created successfully:', user.uid);
    
    // Update user profile with display name
    await updateProfile(user, {
      displayName: fullName
    });
    
    console.log('[Firebase] Profile updated, saving to Firestore...');
    
    // Store additional user data in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      username,
      fullName,
      dateOfBirth,
      email,
      createdAt: new Date().toISOString()
    });
    
    console.log('[Firebase] User data saved to Firestore');
    
    // Send email verification
    await sendEmailVerification(user);
    console.log('[Firebase] Verification email sent to:', email);
    
    return user;
  } catch (error: any) {
    console.error('[Firebase] Sign up error:', error);
    console.error('[Firebase] Error code:', error.code);
    console.error('[Firebase] Error message:', error.message);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// Sign in with email and password
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Check if email is verified
    if (!user.emailVerified) {
      // Sign out the user
      await signOut(auth);
      throw new Error('EMAIL_NOT_VERIFIED');
    }
    
    return user;
  } catch (error: any) {
    if (error.message === 'EMAIL_NOT_VERIFIED') {
      throw new Error('Please verify your email before signing in. Check your inbox for the verification link.');
    }
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    console.log('[Firebase] Google sign-in successful:', user.email);
    
    // Check if user profile exists in Firestore
    const existingProfile = await getUserProfile(user.uid);
    
    if (!existingProfile) {
      // Create profile for new Google user
      console.log('[Firebase] Creating profile for new Google user');
      await setDoc(doc(db, 'users', user.uid), {
        username: user.email?.split('@')[0] || 'user',
        fullName: user.displayName || '',
        dateOfBirth: '',
        email: user.email || '',
        createdAt: new Date().toISOString()
      });
    }
    
    return user;
  } catch (error: any) {
    console.error('[Firebase] Google sign-in error:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
};

// Sign out
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error('Failed to sign out. Please try again.');
  }
};

// Send email verification
export const sendVerificationEmail = async (): Promise<void> => {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No user is currently signed in');
  }
  
  try {
    await sendEmailVerification(user);
    console.log('[Firebase] Verification email sent to:', user.email);
  } catch (error: any) {
    console.error('[Firebase] Error sending verification email:', error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Get user profile from Firestore
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('[Firebase] Fetching profile for user:', userId);
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    
    if (docSnap.exists()) {
      const data = docSnap.data() as UserProfile;
      console.log('[Firebase] Profile data:', data);
      return data;
    } else {
      console.log('[Firebase] No profile document found in Firestore');
      return null;
    }
  } catch (error) {
    console.error('[Firebase] Error fetching user profile:', error);
    return null;
  }
};

// Helper function to convert Firebase error codes to user-friendly messages
const getAuthErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/operation-not-allowed':
      return 'Email/password accounts are not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up first.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please check your credentials.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return 'Authentication failed. Please try again.';
  }
};

export { auth };
