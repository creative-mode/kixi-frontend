import { notFound } from 'next/navigation';
import { DonationDetailView } from '@/components/donations/donation-detail';
import { donationParam } from '@/lib/donations/model';

export const metadata = { title: 'Doação · Kixi Manager' };

export default async function DonationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = donationParam((await params).id);
  if (id === null) notFound();
  return <DonationDetailView id={id} />;
}
