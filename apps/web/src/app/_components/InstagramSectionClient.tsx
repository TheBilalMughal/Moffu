'use client';

import { useState } from 'react';

interface Post {
  id: string;
  handle: string;
  post_url: string;
  thumbnail_url: string | null;
  title: string | null;
}

function getEmbedUrl(postUrl: string): string | null {
  // YouTube
  const ytMatch = postUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`;
  // Instagram
  const igMatch = postUrl.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (igMatch) return `https://www.instagram.com/p/${igMatch[1]}/embed/`;
  return null;
}

function getProfileUrl(handle: string, postUrl: string): string {
  if (postUrl.includes('youtube.com') || postUrl.includes('youtu.be')) {
    return `https://www.youtube.com/@${handle.replace(/^@/, '')}`;
  }
  return `https://www.instagram.com/${handle.replace(/^@/, '')}`;
}

export function InstagramSectionClient({ posts, firstHandle }: { posts: Post[]; firstHandle: string }) {
  const [active, setActive] = useState<Post | null>(null);
  const firstPost = posts[0];
  const profileUrl = firstPost ? getProfileUrl(firstHandle, firstPost.post_url) : `https://www.instagram.com/${firstHandle.replace(/^@/, '')}`;

  return (
    <section className="bg-[#F9FAFB] border-t border-[#E5E7EB] px-6 lg:px-16 py-20 relative">
      <div className="max-w-[1380px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
          <div>
            <p className="text-xs font-semibold text-[#111827]/50 uppercase tracking-widest mb-3">Social</p>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-black text-[#111827] leading-[1.1]">
              See us in action.
            </h2>
          </div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#6C55E8] hover:text-[#5A42D1] transition-colors whitespace-nowrap"
          >
            Follow us →
          </a>
        </div>

        {/* Grid + floating embed wrapper */}
        <div className="relative">
          {/* Cards grid */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-all duration-300 ${active ? 'opacity-30 pointer-events-none' : ''}`}>
            {posts.map((post) => {
              const cleanHandle = post.handle.replace(/^@/, '');
              return (
                <div
                  key={post.id}
                  className="group bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col cursor-pointer"
                  onClick={() => setActive(post)}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full aspect-[9/16] bg-[#111827] flex-shrink-0 overflow-hidden">
                    {post.thumbnail_url ? (
                      <img
                        src={post.thumbnail_url}
                        alt={post.title ?? `@${cleanHandle}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#1F2937]">
                        <svg className="w-10 h-10 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex flex-col flex-1 p-4">
                    <p className="font-black text-[#111827] text-sm leading-snug">@{cleanHandle}</p>
                    {post.title && (
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{post.title}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating embed — centered over grid */}
          {active && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="relative w-full max-w-xs">
                {/* Close */}
                <button
                  onClick={() => setActive(null)}
                  className="absolute -top-10 right-0 flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close
                </button>

                <div className="aspect-[9/16] w-full rounded-2xl overflow-hidden shadow-2xl bg-white border border-[#E5E7EB]">
                  {getEmbedUrl(active.post_url) ? (
                    <iframe
                      src={getEmbedUrl(active.post_url)!}
                      className="w-full h-full border-0"
                      allowFullScreen
                      scrolling="no"
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title={active.title ?? `Instagram post by @${active.handle}`}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#F9FAFB]">
                      <p className="text-sm text-[#6B7280]">Could not embed this post.</p>
                      <a href={active.post_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#6C55E8]">
                        Open on Instagram →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
