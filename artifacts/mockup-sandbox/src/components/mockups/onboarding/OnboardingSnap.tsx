import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function OnboardingSnap() {
  return (
    <div className="w-[390px] h-[844px] overflow-hidden relative flex flex-col bg-[#1a1f3c] font-sans">
      {/* Top Chrome */}
      <div className="absolute top-0 w-full pt-14 px-6 flex justify-between items-center z-20">
        <div className="w-8"></div> {/* Spacer for center alignment */}
        <div className="text-white text-sm font-medium tracking-widest uppercase opacity-80">
          invite
        </div>
        <div className="text-white/60 text-sm font-medium">Skip</div>
      </div>

      {/* Illustration Area */}
      <div className="relative w-full h-[52%] flex items-center justify-center pt-10">
        {/* Background glow / shadow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[300px] bg-[#6366F1]/20 blur-[60px] rounded-full"></div>

        {/* Receipt Card */}
        <div className="relative bg-white w-[260px] rounded-xl shadow-2xl p-5 pb-8 rotate-[-4deg] transform-gpu">
          {/* Top Zig-Zag Edge (simulated with border or just plain rounded card for modern look) - keeping it clean rounded as per modern aesthetic */}
          <div className="flex justify-between items-center mb-6">
            <div className="text-gray-400 font-mono text-xs">Receipt #1029</div>
            <div className="text-gray-400 font-mono text-xs">12:45 PM</div>
          </div>

          <div className="space-y-4">
            {/* Item 1 */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
              <div className="flex-1 flex justify-between font-mono text-sm text-gray-800">
                <span className="truncate">Margherita Pizza</span>
                <span className="text-gray-300 mx-1 flex-1 overflow-hidden">................</span>
                <span>$14.00</span>
              </div>
            </div>
            
            {/* Item 2 */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
              <div className="flex-1 flex justify-between font-mono text-sm text-gray-800">
                <span className="truncate">Caesar Salad</span>
                <span className="text-gray-300 mx-1 flex-1 overflow-hidden">................</span>
                <span>$11.50</span>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#6366F1]" />
              <div className="flex-1 flex justify-between font-mono text-sm text-gray-800">
                <span className="truncate">House Burger</span>
                <span className="text-gray-300 mx-1 flex-1 overflow-hidden">................</span>
                <span>$13.00</span>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0"></div>
              <div className="flex-1 flex justify-between font-mono text-sm text-gray-400">
                <span className="truncate">Tiramisu</span>
                <span className="text-gray-200 mx-1 flex-1 overflow-hidden">................</span>
                <span>$8.50</span>
              </div>
            </div>

            {/* Item 5 */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0"></div>
              <div className="flex-1 flex justify-between font-mono text-sm text-gray-400">
                <span className="truncate">Sparkling Water</span>
                <span className="text-gray-200 mx-1 flex-1 overflow-hidden">................</span>
                <span>$4.00</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between font-mono text-sm font-bold text-gray-800">
            <span>Total</span>
            <span>$51.00</span>
          </div>

          {/* Scan Line Overlay */}
          <div className="absolute top-[55%] left-0 right-0 h-[2px] bg-[#6366F1] shadow-[0_0_8px_2px_rgba(99,102,241,0.5)] z-10"></div>
          {/* Scan highlight */}
          <div className="absolute top-[10%] left-0 right-0 h-[45%] bg-gradient-to-b from-[#6366F1]/5 to-[#6366F1]/20 z-0"></div>

          {/* Floating Emoji */}
          <div className="absolute -top-4 -right-4 text-4xl drop-shadow-lg rotate-12">
            📷
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-end pb-[34px]">
        <div className="px-6 mb-10">
          <h1 className="text-white text-4xl font-bold leading-tight whitespace-pre-line">
            {'Snap a receipt.\ninvite reads it.'}
          </h1>
          <p className="text-[#94A3B8] text-base mt-3 leading-relaxed">
            One photo. Every item. No manual entry.
          </p>
        </div>

        {/* Bottom Actions */}
        <div className="px-6 space-y-8 flex flex-col items-center">
          {/* Progress Dots */}
          <div className="flex gap-[6px]">
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white"></div>
            <div className="w-2 h-2 rounded-full bg-white/30"></div>
          </div>

          {/* CTA Button */}
          <button className="w-full bg-[#6366F1] text-white font-semibold py-4 rounded-2xl text-lg hover:bg-[#5558E6] transition-colors active:scale-[0.98]">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export default OnboardingSnap;
