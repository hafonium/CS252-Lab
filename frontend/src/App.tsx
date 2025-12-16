import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import "./styles.css";
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import VerifyEmail from './pages/VerifyEmail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/" element={<MapPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
