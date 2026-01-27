import { HelmetProvider, Helmet } from "react-helmet-async";
import { useSettings } from "../../context/SettingsContext";

const PageMeta = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  const { systemName } = useSettings();
  
  // Extract the base page title (remove any existing "|" suffix)
  // Format: {pageTitle} | {SYSTEM_NAME} (matches CI3 header.php format)
  const baseTitle = title.split(" | ")[0].trim();
  const fullTitle = `${baseTitle} | ${systemName}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
};

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>{children}</HelmetProvider>
);

export default PageMeta;
