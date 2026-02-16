export default function SidebarWidget() {
  return (
    <div
      className={`
        mx-auto mb-10 w-full max-w-60 rounded-2xl px-4 py-5 text-center`}
    >
      {/*<h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
        Powered by
      </h3>*/}
      {/* <p className="mb-4 text-gray-500 text-theme-sm dark:text-gray-400">
        Leading Tailwind CSS Admin Template with 400+ UI Component and Pages.
      </p> */}
      {/*<a href="https://ktechproducts.com" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
        <img src="/images/logo/logo.jpg" className="h-12 object-contain" alt="KTP-Logo" onError={(e) => {
          (e.target as HTMLImageElement).src = "/images/logo/KTECHPRODUCTS_Logo-white.svg";
        }} />
      </a>*/}
    </div>
  );
}
