const videoUrl =
  "https://videos.pexels.com/video-files/3141208/3141208-uhd_2560_1440_25fps.mp4";
const posterUrl =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1800&q=80";

export function AmbientBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#03060b]">
      <video
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-[0.16] mix-blend-screen saturate-50"
        autoPlay
        muted
        loop
        playsInline
        poster={posterUrl}
      >
        <source src={videoUrl} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(20,184,166,0.14),transparent_30%),radial-gradient(circle_at_50%_88%,rgba(245,158,11,0.10),transparent_34%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:88px_88px] opacity-20" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03060b]/50 via-[#03060b]/86 to-[#03060b]" />
      <div className="scanline absolute inset-x-0 top-0 h-40 opacity-60" />
    </div>
  );
}
