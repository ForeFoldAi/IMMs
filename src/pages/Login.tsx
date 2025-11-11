import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Eye, EyeOff, Loader2, Wheat } from 'lucide-react';
import { useRole, UserRole, deriveUserRole } from '../contexts/RoleContext';
import { toast } from '../hooks/use-toast';
import { authService } from '../lib/api/auth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setCurrentUser } = useRole();

  const getRoleRedirectPath = (role: UserRole) => {
    switch (role) {
      case 'supervisor':
        return '/materials-inventory';
      case 'company_owner':
        return '/';
      default:
        return '/';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const apiResp = await authService.login({ email, password });
      const apiUser = apiResp.user;
      const permissions = authService.getPermissions();

      const derivedRole = deriveUserRole(apiUser.userType, permissions) as UserRole;

      setCurrentUser({
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        role: derivedRole,
        department: apiUser.branch?.name,
      });

      window.dispatchEvent(new Event('auth:updated'));

      toast({
        title: 'Login Successful',
        description: `Welcome back, ${apiUser?.name || 'User'}!`,
      });

      const redirectPath = getRoleRedirectPath(derivedRole);
      navigate(redirectPath);
    } catch (err) {
      toast({
        title: 'Login Failed',
        description: 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen relative flex items-center justify-center p-4 overflow-hidden'>
      {/* Background image */}
      <div 
        className='absolute inset-0 bg-cover bg-center bg-no-repeat'
        style={{
          backgroundImage: 'url(/bg.jpg)',
        }}
      ></div>
      
      {/* Dark overlay for better text readability */}
      <div className='absolute inset-0 bg-black/40'></div>

      {/* Main content */}
      <div className='w-full max-w-md relative z-10'>
        <Card className='w-full mx-auto shadow-2xl border border-slate-700/50 bg-white/95 backdrop-blur-md'>
          <CardHeader className='text-center space-y-4 pb-8 pt-8'>
            
            
            <div className='space-y-2'>
              <div className='flex items-center justify-center'>
                <img 
                  src="/bg.png" 
                  alt="Sree Sal Roller Flour Mill Pvt Ltd" 
                  className='h-20 w-auto object-contain'
                  style={{
                    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1))',
                    mixBlendMode: 'multiply'
                  }}
                />
              </div>
            </div>

            <CardDescription className='text-sm text-slate-900'>
            Sign in to access the Operations Management System
            </CardDescription>
            
            <div className='h-1 w-24 mx-auto rounded-full shadow-sm' style={{ 
              background: 'linear-gradient(90deg, #f2b10e 0%, #d99b0c 50%, #f2b10e 100%)' 
            }}></div>
          </CardHeader>
          
          <CardContent className='pb-8 px-8'>
            <form onSubmit={handleLogin} className='space-y-5'>
              <div className='space-y-2'>
                <Label htmlFor='email' className='text-slate-700 font-semibold text-sm'>
                  Email Address
                </Label>
                <Input
                  id='email'
                  type='email'
                  placeholder='Enter your email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className='h-12 border border-slate-200 rounded-lg transition-colors focus:outline-none focus:border-f2b10e focus:ring-2 focus:ring-f2b10e/20'
                  style={{
                    outlineColor: '#f2b10e'
                  }}
                />
              </div>
              
              <div className='space-y-2'>
                <Label htmlFor='password' className='text-slate-700 font-semibold text-sm'>
                  Password
                </Label>
                <div className='relative'>
                  <Input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    placeholder='Enter your password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className='pr-12 h-12 border border-slate-200 rounded-lg transition-colors focus:border-f2b10e focus:ring-2 focus:ring-f2b10e/20'
                    style={{
                      outlineColor: '#f2b10e'
                    }}
                  />
                  <button
                    type='button'
                    onClick={() => setShowPassword(!showPassword)}
                    className='absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none transition-colors'
                    disabled={isLoading}
                    style={{
                      color: showPassword ? '#f2b10e' : ''
                    }}
                  >
                    {showPassword ? (
                      <EyeOff className='h-5 w-5' />
                    ) : (
                      <Eye className='h-5 w-5' />
                    )}
                  </button>
                </div>
              </div>

              <Button 
                type='submit' 
                className='w-full h-12 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] rounded-lg border-0' 
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, #f2b10e 0%, #d99b0c 100%)',
                  opacity: isLoading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #d99b0c 0%, #c28a0b 100%)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #f2b10e 0%, #d99b0c 100%)';
                  }
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className='mt-6 text-center'>
              <p className='text-xs text-slate-500 font-medium'>
                Secure Enterprise Access System (SEAS)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer credits */}
        <div className='mt-6 space-y-2'>
          
          <div className='text-center'>
            <p className='text-xs text-slate-400'>
            Developed & Maintained by <span className='font-semibold' style={{ color: '#f2b10e' }}><a 
            href="https://forefoldai.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline transition-colors duration-200"
          >
            ForeFold AI
          </a></span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;