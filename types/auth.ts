export interface CurrentUser {
  id: number;
  email: string;
  name: string | null;
  role: string;
  accountId?: string;
  roles?: string[];
}
