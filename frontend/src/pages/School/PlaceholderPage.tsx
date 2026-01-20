import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <PageWrapper>
      <PageMeta
        title={`${title} |High School Module`}
        description={description || `${title} page`}
      />
      <PageBreadcrumb pageTitle={title} />

      <PageContainer>
        <div className="text-center py-12">
          <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl mb-4">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            This page is under development and will be implemented soon.
          </p>
        </div>
      </PageContainer>
    </PageWrapper>
  );
}



