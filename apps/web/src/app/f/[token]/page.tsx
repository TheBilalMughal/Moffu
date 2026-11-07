import type { Metadata } from 'next';
import { FeedbackClient } from './FeedbackClient';

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: 'Share your experience',
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({ params }: Props) {
  const { token } = await params;
  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/feedback-gate`;

  let pageData: {
    id: string;
    customer_name: string | null;
    org_name: string;
    google_review_url: string | null;
  } | null = null;

  let errorState: 'not_found' | 'expired' | 'already_responded' | null = null;

  try {
    const res = await fetch(`${edgeFnUrl}?token=${encodeURIComponent(token)}`, {
      next: { revalidate: 0 },
    });
    if (res.status === 404) { errorState = 'not_found'; }
    else if (res.status === 410) { errorState = 'expired'; }
    else if (res.status === 409) { errorState = 'already_responded'; }
    else if (res.ok) { pageData = await res.json(); }
    else { errorState = 'not_found'; }
  } catch {
    errorState = 'not_found';
  }

  if (errorState) {
    const messages: Record<string, { title: string; sub: string }> = {
      not_found:        { title: 'Link not found',      sub: 'This feedback link is invalid or has been removed.' },
      expired:          { title: 'Link expired',        sub: 'This feedback link is no longer active.' },
      already_responded:{ title: 'Already submitted',   sub: 'You have already submitted your feedback. Thank you!' },
    };
    const { title, sub } = messages[errorState]!;
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-[#E5EAE8] shadow-sm px-8 py-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#111111] flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[#111827] mb-2">{title}</h1>
          <p className="text-sm text-[#6B7280]">{sub}</p>
        </div>
      </div>
    );
  }

  return (
    <FeedbackClient
      token={token}
      customerName={pageData?.customer_name ?? null}
      orgName={pageData?.org_name ?? 'this business'}
      googleReviewUrl={pageData?.google_review_url ?? null}
      edgeFnUrl={edgeFnUrl}
    />
  );
}
