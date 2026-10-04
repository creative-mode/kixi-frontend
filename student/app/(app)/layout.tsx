import { AppNav } from '@/components/AppNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="screen screen--shell kx-lcd">
      <div className="screen__pane">{children}</div>
      <AppNav />
    </div>
  );
}
