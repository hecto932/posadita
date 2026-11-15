import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Skeleton } from '@/components/EventBits';
import { ParticipantView } from '@/components/ParticipantView';
import * as svc from '@/lib/service';

export const metadata: Metadata = { title: 'Mi amigo secreto', robots: { index: false, follow: false } };

export default function ParticipantPage({ params, searchParams }: PageProps<'/p/[token]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ParticipantContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ParticipantContent({ params, searchParams }: Pick<PageProps<'/p/[token]'>, 'params' | 'searchParams'>) {
  const [{ token }, sp] = await Promise.all([params, searchParams]);
  const me = await svc.getParticipantByToken(token);
  if (!me) notFound();
  return <ParticipantView participant={me.participant} event={me.event} token={token} welcome={!!sp.bienvenida} />;
}
