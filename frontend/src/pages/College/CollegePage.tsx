import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";

interface CollegePageProps {
  title: string;
  description?: string;
  pageTitle?: string;
}

export default function CollegePage({ 
  title, 
  description = "College module page",
  pageTitle 
}: CollegePageProps) {
  const displayTitle = pageTitle || title;
  
  return (
    <div>
      <PageMeta
        title={`${title} | College Module`}
        description={description}
      />
      <PageBreadcrumb pageTitle={displayTitle} />
      <div className="min-h-screen rounded-2xl border border-gray-200 bg-[var(--color-surface)] px-5 py-7 dark:border-gray-800 xl:px-10 xl:py-12">
        <div className="mx-auto w-full">
          <h3 className="mb-4 font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
            {displayTitle}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            This page is under development. Content will be added here.
          </p>
        </div>
      </div>
    </div>
  );
}


