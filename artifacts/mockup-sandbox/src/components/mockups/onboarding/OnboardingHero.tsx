import React from "react";

export function OnboardingHero() {
  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#1a1f3c] font-sans">
      {/* Top Chrome */}
      <div className="absolute top-0 w-full pt-14 px-6 flex justify-between items-center z-10">
        <div className="flex-1"></div>
        <div className="flex-1 flex justify-center">
          <span className="text-white text-sm tracking-widest font-light italic opacity-80">
            invite
          </span>
        </div>
        <div className="flex-1 flex justify-end">
          <button className="text-white/80 text-sm font-medium">Skip</button>
        </div>
      </div>

      {/* Illustration Area (Top 55%) */}
      <div className="h-[55%] relative flex items-center justify-center">
        {/* Abstract "table" background elements to ground the emojis */}
        <div className="absolute w-[240px] h-[120px] bg-white/5 rounded-[100%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 blur-xl"></div>
        
        {/* Playful Emoji Scene */}
        <div className="relative w-full h-full">
          {/* Main characters/food */}
          <div className="absolute top-[40%] left-[20%] text-[56px] transform -rotate-12 animate-bounce" style={{ animationDuration: '3s' }}>🍕</div>
          <div className="absolute top-[45%] right-[25%] text-[48px] transform rotate-12">🍣</div>
          <div className="absolute top-[30%] left-[45%] text-[64px] z-10">👩🏽‍</div>
          <div className="absolute top-[35%] right-[15%] text-[56px]">👨🏻‍</div>
          <div className="absolute top-[50%] left-[40%] text-[48px] z-20">🍷</div>
          <div className="absolute top-[35%] left-[10%] text-[50px] transform -rotate-6">🍔</div>
          
          {/* Sparkles */}
          <div className="absolute top-[25%] left-[25%] text-2xl animate-pulse">✨</div>
          <div className="absolute top-[40%] right-[10%] text-3xl animate-pulse" style={{ animationDelay: '1s' }}>✨</div>
          <div className="absolute top-[60%] left-[30%] text-xl animate-pulse" style={{ animationDelay: '0.5s' }}>✨</div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col px-6">
        <h1 className="text-white text-[42px] font-bold leading-[1.1] tracking-tight whitespace-pre-line mt-2">
          Split bills,{"\n"}not friendships
        </h1>
        <p className="text-[#94A3B8] text-[17px] leading-relaxed mt-4 max-w-[320px]">
          Plan dinners, invite your crew, and split the bill — no awkwardness, ever.
        </p>
      </div>

      {/* Bottom Chrome */}
      <div className="pb-[34px] flex flex-col gap-5">
        {/* Progress Dots */}
        <div className="flex justify-center items-center gap-[6px]">
          <div className="w-2 h-2 rounded-full bg-white"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
          <div className="w-2 h-2 rounded-full bg-white/30"></div>
        </div>

        {/* CTA Button */}
        <div className="px-6">
          <button className="w-full bg-[#6366F1] text-white font-semibold text-[17px] py-4 rounded-2xl active:scale-[0.98] transition-transform">
            Get started &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
