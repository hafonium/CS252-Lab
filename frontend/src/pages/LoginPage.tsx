import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Login from '../components/Login';
import type { User } from 'firebase/auth';

const VIETNAM_IMAGES = [
  './src/assets/vn-pic1.jpg',
  './src/assets/vn-pic2.jpg',
  './src/assets/vn-pic3.jpg',
  './src/assets/vn-pic4.jpg',
  './src/assets/vn-pic5.jpg',
  './src/assets/vn-pic6.jpg',
  './src/assets/vn-pic7.jpg',
  './src/assets/vn-pic8.jpg',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % VIETNAM_IMAGES.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (user: User) => {
    if (!user.emailVerified) {
      navigate('/verify-email');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="login-page">
      <div className="slideshow-background">
        {VIETNAM_IMAGES.map((image, index) => (
          <div
            key={image}
            className={`slide ${index === currentImageIndex ? 'active' : ''}`}
            style={{ backgroundImage: `url(${image})` }}
          />
        ))}
        <div className="slideshow-overlay" />
      </div>
      <div className="login-content">
        <Login onLoginSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
}
