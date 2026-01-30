import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";

export default function Verifiers() {
  return (
    <PageWrapper>
      <PageMeta title="Verifiers | OCR" description="OCR Verifiers list" />
      <PageBreadcrumb pageTitle="Verifiers" />
      <PageContainer>
        <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
          Verifiers
        </h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage verifiers for OCR batches.
        </p>
      </PageContainer>
    </PageWrapper>
  );
}
