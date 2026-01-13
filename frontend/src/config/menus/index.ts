import { MenuConfig, ModuleType } from "../../types/menu";
import { collegeMenu } from "./college";
import { schoolMenu } from "./school";
import { ocrverifyMenu } from "./ocrverify";

export { collegeMenu } from "./college";
export { schoolMenu } from "./school";
export { ocrverifyMenu } from "./ocrverify";

export const menus: Record<ModuleType, MenuConfig> = {
  college: collegeMenu,
  school: schoolMenu,
  ocrverify: ocrverifyMenu,
};

export const getMenuByModule = (module: ModuleType): MenuConfig => {
  return menus[module];
};

