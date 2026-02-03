type ThemedLoaderProps = {
  size?: number;
  className?: string;
  label?: string;
  title?: string;
  description?: string;
  showProgress?: boolean;
};

export default function ThemedLoader({
  size = 80,
  className = "",
  label = "Loading",
  title = "Loading",
  description = "Please wait while we load your data...",
  showProgress = true,
}: ThemedLoaderProps) {
  return (
    <div className={`mx-auto text-center ${className}`} role="status" aria-label={label}>
      <style>{`
        @keyframes spin-ring-cw {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes spin-ring-ccw {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        
        @keyframes progress-bar {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
      
      {/* Spinner Container */}
      <div
        className="relative mx-auto mb-6"
        style={{ width: size, height: size }}
      >
        {/* Ring 1 - Outer (Clockwise, Slow) */}
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-current"
          style={{
            animation: 'spin-ring-cw 2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            opacity: 0.9,
          }}
        />
        
        {/* Ring 2 - Middle (Counter-clockwise, Medium) */}
        <div
          className="absolute rounded-full border-[3px] border-transparent border-t-current border-b-current"
          style={{
            inset: `${size * 0.15}px`,
            animation: 'spin-ring-ccw 1.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            opacity: 0.7,
          }}
        />
        
        {/* Ring 3 - Inner (Clockwise, Fast) */}
        <div
          className="absolute rounded-full border-[3px] border-transparent border-t-current border-r-current"
          style={{
            inset: `${size * 0.3}px`,
            animation: 'spin-ring-cw 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            opacity: 0.5,
          }}
        />
        
        {/* Center Dot */}
        <div
          className="absolute bg-current rounded-full"
          style={{
            inset: `${size * 0.45}px`,
            animation: 'pulse-glow 1.5s ease-in-out infinite',
          }}
        />
      </div>
      
      {/* Loading Title */}
      {title && (
        <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">
          {title}
        </h3>
      )}
      
      {/* Description */}
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-xs mx-auto">
          {description}
        </p>
      )}
      
      {/* Progress Bar */}
      {showProgress && (
        <div className="w-48 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto">
          <div
            className="h-full bg-current rounded-full"
            style={{
              animation: 'progress-bar 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}
