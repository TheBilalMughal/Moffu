import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Team',
  description: 'Meet the people building Moffu. A small team obsessed with helping businesses respond to Google reviews.',
  alternates: { canonical: 'https://www.moffu.pro/team' },
  openGraph: {
    title: 'Team | Moffu',
    description: 'Meet the people building Moffu. A small team obsessed with helping businesses respond to Google reviews.',
    url: 'https://www.moffu.pro/team',
  },
};

interface TeamMember {
  id: string;
  name: string;
  designation: string;
  image_url: string | null;
  linkedin_url: string | null;
}

function MemberInitials({ name, size }: { name: string; size: number }) {
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className="rounded-2xl bg-[#6C55E8] text-white font-black flex items-center justify-center select-none"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default async function TeamPage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('team_members')
    .select('id, name, designation, image_url, linkedin_url')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const members = (data ?? []) as TeamMember[];

  return (
    <main className="min-h-screen bg-white">
      {/* White zone behind fixed navbar */}
      <div className="bg-white h-28" />

      {/* Hero */}
      <section className="bg-[#F9FAFB] border-b border-[#E5E7EB] px-6 lg:px-16 py-20">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-5">The team</p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-black text-[#111827] leading-[1.0] max-w-2xl">
              Small team.<br />Big obsession.
            </h1>
            <p className="text-[#6B7280] text-base leading-relaxed max-w-sm lg:text-right">
              We built Moffu because we got tired of seeing great businesses lose customers to bad reviews they never responded to.
            </p>
          </div>
        </div>
      </section>

      {/* Team grid */}
      <section className="px-6 lg:px-16 py-20">
        <div className="max-w-[1380px] mx-auto">
          {members.length === 0 ? (
            <p className="text-[#9CA3AF] text-center py-20">Team coming soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="group bg-white rounded-2xl border border-[#E5E7EB] p-6 hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col"
                >
                  {/* Photo */}
                  <div className="mb-5">
                    {member.image_url ? (
                      <img
                        src={member.image_url}
                        alt={member.name}
                        className="w-20 h-20 rounded-2xl object-cover border border-[#E5E7EB]"
                      />
                    ) : (
                      <MemberInitials name={member.name} size={80} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <p className="font-black text-[#111827] text-base leading-snug">{member.name}</p>
                    <p className="text-sm text-[#6B7280] mt-1 leading-snug">{member.designation}</p>
                  </div>

                  {/* LinkedIn */}
                  {member.linkedin_url && (
                    <div className="mt-5 pt-4 border-t border-[#F3F4F6]">
                      <a
                        href={member.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B7280] hover:text-[#0A66C2] transition-colors group-hover:text-[#0A66C2]"
                        aria-label={`${member.name} on LinkedIn`}
                      >
                        <LinkedInIcon />
                        LinkedIn
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Values strip */}
      <section className="border-t border-[#E5E7EB] px-6 lg:px-16 py-16 bg-[#F9FAFB]">
        <div className="max-w-[1380px] mx-auto">
          <p className="text-xs font-semibold text-[#6C55E8] uppercase tracking-widest mb-10 text-center">What drives us</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                label: 'Authenticity over automation',
                body: 'AI should help you sound like yourself, not like a template. Every reply we generate reflects your real voice.',
              },
              {
                label: 'Reputation is revenue',
                body: 'A one-star drop costs real money. We take review management seriously because your customers do too.',
              },
              {
                label: 'Simple wins',
                body: 'No bloated dashboards, no six-month onboarding. If it takes more than a minute to understand, we redesign it.',
              },
            ].map(({ label, body }) => (
              <div key={label} className="flex flex-col gap-3">
                <div className="w-8 h-1 rounded-full bg-[#6C55E8]" />
                <p className="font-black text-[#111827] text-base leading-snug">{label}</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#111827] px-6 lg:px-16 py-20">
        <div className="max-w-[1380px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Work with us</p>
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-black text-white leading-[1.05]">
              Want to join the team?
            </h2>
            <p className="text-white/50 text-base mt-3 max-w-md">
              We hire for craft, curiosity, and care. If that sounds like you, say hi.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <a
              href="mailto:Hello@moffu.pro"
              className="inline-flex items-center gap-2 bg-[#D8CCFF] text-[#111111] font-black text-sm px-7 py-3.5 rounded-lg hover:scale-105 active:scale-95 transition-transform duration-150 whitespace-nowrap"
            >
              Say hi
            </a>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
            >
              Our story →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
