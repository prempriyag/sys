import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageContainer, { PageWrapper } from "../../components/common/PageContainer";

export default function ToBeAssignedBatches() {
  return (
    <PageWrapper>
      <PageMeta title="To Be Assigned | OCR" description="To Be Assigned batches" />
      <PageBreadcrumb pageTitle="To Be Assigned" />
      <PageContainer>
        <h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
          To Be Assigned Batches
        </h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Batches pending assignment to verifiers.
        </p>
      </PageContainer>
    </PageWrapper>
  );
}
