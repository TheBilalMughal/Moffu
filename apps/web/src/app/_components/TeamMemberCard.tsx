interface TeamMemberCardProps {
  name: string;
  designation: string;
  image_url: string | null;
  linkedin_url?: string | null;
}

function LinkedInIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function TeamMemberCard({ name, designation, image_url, linkedin_url }: TeamMemberCardProps) {
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="group bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col">
      {/* Photo — full-width cover */}
      <div className="w-full h-80 bg-[#F3F4F6] flex-shrink-0">
        {image_url ? (
          <img
            src={image_url}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-[#6C55E8] flex items-center justify-center">
            <span className="text-white font-black text-5xl select-none">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-6">
        <div className="flex-1">
          <p className="font-black text-[#111827] text-base leading-snug">{name}</p>
          <p className="text-sm text-[#6B7280] mt-1 leading-snug">{designation}</p>
        </div>

        {linkedin_url && (
          <div className="mt-5 pt-4 border-t border-[#F3F4F6]">
            <a
              href={linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#6B7280] hover:text-[#0A66C2] transition-colors group-hover:text-[#0A66C2]"
              aria-label={`${name} on LinkedIn`}
            >
              <LinkedInIcon />
              LinkedIn
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
