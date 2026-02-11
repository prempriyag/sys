import React, { useMemo } from "react";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

function Particles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        size: 1 + (((i * 7 + 3) % 5) * 0.8),
        left: ((i * 17 + 11) % 100),
        top: ((i * 23 + 7) % 100),
        delay: ((i * 3 + 1) % 8),
        duration: 4 + ((i * 5 + 2) % 6),
        opacity: 0.15 + ((i * 11 + 3) % 5) * 0.08,
      })),
    []
  );
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="auth-particle"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: `${p.left}%`,
            top: `${p.top}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: p.opacity,
          }}
        />
      ))}
    </>
  );
}

function FloatingOrbs() {
  return (
    <>
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />
      <div className="auth-orb auth-orb-4" />
    </>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-animated-bg">
      {/* Background image layer */}
      <div className="auth-bg-image" />

      {/* Animated overlay effects */}
      <div className="auth-overlay" />
      <FloatingOrbs />
      <Particles />
      <div className="auth-scanline" />

      {/* Centered glassmorphism form */}
      <div className="relative z-10 flex items-center justify-center w-full min-h-screen px-4 py-8">
        <div className="auth-glass-card w-full max-w-md p-8 sm:p-10 auth-fade-in">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              width={180}
              height={38}
              src="/images/logo/auth-logo.png"
              alt="Logo"
              className="drop-shadow-lg"
            />
          </div>
          {children}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="fixed z-50 bottom-6 right-6">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
