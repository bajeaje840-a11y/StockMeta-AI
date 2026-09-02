import React, { useState, useEffect, useRef } from 'react';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';

interface PinProtectionModalProps {
  onUnlock: () => void;
}

const CORRECT_PIN = '14418';

export function PinProtectionModal({ onUnlock }: PinProtectionModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on mount
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.trim() === CORRECT_PIN) {
      setError(false);
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
    setPin(val);
    if (error) setError(false);

    if (val.length === 5) {
      if (val === CORRECT_PIN) {
        setError(false);
        onUnlock();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
          inputRef.current?.focus();
        }, 400);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all animate-fade-in">
      <div
        className={`w-full max-w-sm bg-white dark:bg-[#121215] border border-zinc-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all duration-300 ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Lock Icon Emblem */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-900 dark:text-zinc-100 mb-3">
            <Lock className="w-4 h-4 stroke-[2]" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Security Access</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Enter 5-digit PIN to access StockMeta AI
          </p>
        </div>

        {/* PIN Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <div className="relative flex justify-center items-center">
              {/* Real hidden/transparent input for smooth typing */}
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={pin}
                onChange={handlePinChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 text-center tracking-widest text-transparent"
                autoComplete="off"
                autoFocus
              />

              {/* 5 Digit Visual Boxes */}
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3, 4].map((index) => {
                  const digit = pin[index];
                  const isFilled = digit !== undefined;
                  const isCurrent = pin.length === index;

                  return (
                    <div
                      key={index}
                      className={`w-10 h-12 flex items-center justify-center text-lg font-bold rounded-lg border transition-all duration-150 ${
                        error
                          ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                          : isFilled
                          ? 'border-zinc-400 dark:border-zinc-500 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : isCurrent
                          ? 'border-zinc-400 dark:border-zinc-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-400/30'
                          : 'border-zinc-200 dark:border-white/[0.08] bg-zinc-50 dark:bg-zinc-950 text-zinc-400'
                      }`}
                    >
                      {isFilled ? '●' : ''}
                    </div>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-rose-500 font-medium pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Incorrect PIN code.</span>
              </div>
            )}
          </div>

          {/* Unlock Dashboard Button */}
          <button
            type="submit"
            disabled={pin.length !== 5}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              pin.length === 5
                ? 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 cursor-pointer'
                : 'bg-zinc-100 dark:bg-zinc-850 text-zinc-400 dark:text-zinc-600 cursor-not-allowed border border-zinc-200 dark:border-white/[0.04]'
            }`}
          >
            <span>Unlock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Developer Credit Footer */}
        <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-white/[0.06] flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Crafted by <strong className="text-zinc-800 dark:text-zinc-200 font-medium">Woalid</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
