import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";

export default function AssignBatches() {
  return (
    <PageWrapper>
      <PageMeta title="Assign Batches | OCR" description="From-To Assign Batches" />
      <PageBreadcrumb pageTitle="Assign Batches" />
      <PageContainer>
        <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
          From-To Assign Batches
        </h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Assign OCR batches to verifiers.
        </p>
      </PageContainer>
    </PageWrapper>
  );
}
