import { Bell, Bookmark, BookOpen, Camera, Check, ChevronLeft, ChevronRight, Clock, Ellipsis, FileText, Flag, House, Info, LogOut, MessageCircle, Plus, Search, Send, ThumbsUp, TrendingUp, User, Users, X, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  home: House, file: FileText, users: Users, chat: MessageCircle, user: User, search: Search, bell: Bell, plus: Plus,
  useful: ThumbsUp, bookmark: Bookmark, clock: Clock, flag: Flag, check: Check, x: X, camera: Camera, right: ChevronRight,
  left: ChevronLeft, send: Send, out: LogOut, trend: TrendingUp, book: BookOpen, info: Info, dots: Ellipsis,
};

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const C = ICONS[name] ?? Info;
  return <C className={className} size={size} strokeWidth={1.8} aria-hidden="true" />;
}
