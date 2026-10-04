import { AppNav } from '@/components/AppNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen kx-lcd">
      {children}
      <AppNav />
    </div>
  );
}
