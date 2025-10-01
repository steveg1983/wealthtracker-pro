import SimpleSignIn from '../components/auth/SimpleSignIn';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

export default function Login() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();

  // Redirect if already signed in
  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  return <SimpleSignIn />;
}