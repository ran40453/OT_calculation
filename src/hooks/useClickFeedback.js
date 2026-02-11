import { useEffect, useRef } from 'react';

export function useClickFeedback() {
    // Lazy initialization of AudioContext
    const audioCtxRef = useRef(null);

    useEffect(() => {
        const handleClick = () => {
            // Haptic Feedback (Mobile)
            if (navigator.vibrate) {
                try {
                    navigator.vibrate(10); // Short, sharp pulse (increased from 5ms for better perceptibility)
                } catch (e) {
                    // Ignore errors if vibration not supported/allowed
                }
            }

            // Audio Feedback (Desktop/Mobile)
            try {
                if (!audioCtxRef.current) {
                    // Create context on first interaction to bypass autoplay policies
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                        audioCtxRef.current = new AudioContext();
                    }
                }

                const ctx = audioCtxRef.current;
                if (ctx && ctx.state !== 'closed') {
                    // Resume if suspended (common in browsers)
                    if (ctx.state === 'suspended') {
                        ctx.resume();
                    }

                    // Sound Design: "Thud" / "Wooden Kick"
                    // Low frequency punch: 80Hz -> 40Hz
                    const t = ctx.currentTime;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();

                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    osc.type = 'triangle'; // Triangle has a bit more "wood" character than sine

                    // Frequency envelope (Pitch drop)
                    osc.frequency.setValueAtTime(80, t);
                    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

                    // Amplitude envelope (Short decay)
                    gain.gain.setValueAtTime(0.0, t); // Start silence
                    gain.gain.linearRampToValueAtTime(0.4, t + 0.005); // Attack (click)
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08); // Release

                    osc.start(t);
                    osc.stop(t + 0.1);

                    // Cleanup usually handled by GC, but explicit disconnect is safer for many nodes
                    setTimeout(() => {
                        osc.disconnect();
                        gain.disconnect();
                    }, 150);
                }
            } catch (err) {
                console.warn('Audio feedback failed:', err);
            }
        };

        // Attach to window capture phase to ensure it runs before other handlers stop propagation
        // (Though for feedback, usually helpful to run even if logic stops it, capture is safer)
        window.addEventListener('click', handleClick, true);

        // Cleanup
        return () => {
            window.removeEventListener('click', handleClick, true);
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
                audioCtxRef.current = null;
            }
        };
    }, []);
}
