import logo from '/logo.png';
import { useRole } from '../contexts/RoleContext';
import { RoleSwitcher } from './RoleSwitcher';
import { Bell } from 'lucide-react';
import { Button } from './ui/button';
import { getFirebaseToken } from '@/config/firebase';
import { notificationApi } from '@/lib/api/notification';

export const TopHeaderSimple = () => {
  const { currentUser } = useRole();

  // Firebase notification handler - kept for push notifications
  const handleGetFirebaseToken = async () => {
    const token = await getFirebaseToken();
    if (token) {
      await notificationApi.subscribeToNotification({
        token,
        deviceModel: window.navigator.userAgent,
        platform: 'web',
        appVersion: import.meta.env.VITE_APP_VERSION,
      });
    }
  };

  if (!currentUser) return null;

  return (
    <header className='fixed top-0 left-0 right-0 z-50  bg-gradient-to-r from-foreground to-foreground backdrop-blur-md   shadow-sm'>
      <div className='max-w-full mx-auto px-4'>
        <div className='flex items-center justify-between h-16'>
          {/* Company Logo & Name */}
          <div className='flex items-center space-x-4'>
            <img
              src={logo}
              alt='Sree Sai Logo'
              className='h-12 w-auto object-contain rounded-xl shadow-lg'
            />
          </div>

          {/* Profile Section - Right Side */}
          <div className='flex items-center space-x-4'>
            {/* Firebase Push Notification Enable Button */}
            <Button
              variant='outline'
              size='sm'
              onClick={handleGetFirebaseToken}
            >
              <Bell className='w-5 h-5' />
              Enable
            </Button>
            <RoleSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
};
