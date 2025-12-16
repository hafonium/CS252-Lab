import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, sendVerificationEmail } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebaseService';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      navigate('/login');
      return;
    }

    setUserEmail(user.email || '');

    // Check if email is already verified
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        await currentUser.reload(); // Refresh user data
        if (currentUser.emailVerified) {
          navigate('/');
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleResendEmail = async () => {
    setResending(true);
    setMessage('');
    
    try {
      await sendVerificationEmail();
      setMessage('Verification email sent! Please check your inbox.');
    } catch (error) {
      setMessage('Failed to send verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    const user = getCurrentUser();
    if (user) {
      await user.reload();
      if (user.emailVerified) {
        navigate('/');
      } else {
        setMessage('Email not verified yet. Please check your inbox and click the verification link.');
      }
    }
  };

  return (
    <div className="verify-email-container">
      <div className="verify-email-box">
        <div className="verify-icon">📧</div>
        <h2>Verify Your Email</h2>
        <p className="verify-message">
          We've sent a verification email to:
        </p>
        <p className="verify-email">{userEmail}</p>
        <p className="verify-instructions">
          Please check your inbox and click the verification link to activate your account.
        </p>

        {message && (
          <div className={`verify-alert ${message.includes('sent') ? 'success' : 'info'}`}>
            {message}
          </div>
        )}

        <div className="verify-actions">
          <button 
            onClick={handleCheckVerification} 
            className="btn-primary"
          >
            I've Verified My Email
          </button>
          
          <button 
            onClick={handleResendEmail} 
            className="btn-secondary"
            disabled={resending}
          >
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button 
            onClick={() => navigate('/login')} 
            className="btn-text"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
