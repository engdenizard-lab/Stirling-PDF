import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
} from "@editor/hooks/tools/shared/useToolOperation";
import {
  objectToFormData,
  type ToolApiParams,
  type ToolEndpoint,
} from "@editor/hooks/tools/shared/toolApiMapping";
import { removePagesLocally } from "@editor/utils/localPdfPages";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateRemovePagesParameters,
  RemovePagesParameters,
  defaultParameters,
} from "@editor/hooks/tools/removePages/useRemovePagesParameters";
// import { useToolResources } from '@editor/hooks/tools/shared/useToolResources';

const ENDPOINT = "/api/v1/general/remove-pages" satisfies ToolEndpoint;
type RemovePagesApiParams = ToolApiParams[typeof ENDPOINT];

// Convert the tool's UI parameters into the remove-pages request body. The
// return type is the generated backend model, so a spec change that renames or
// drops a field breaks the build here.
export const removePagesToApiParams = (
  parameters: RemovePagesParameters,
): RemovePagesApiParams => ({
  pageNumbers: parameters.pageNumbers.replace(/\s+/g, ""),
});

// Reconstruct the tool's UI parameters from a remove-pages request body, so a
// stored or AI-authored step can be re-rendered in the settings UI.
export const removePagesFromApiParams = (
  apiParams: RemovePagesApiParams,
): Partial<RemovePagesParameters> => ({
  pageNumbers: apiParams.pageNumbers ?? defaultParameters.pageNumbers,
});

export const buildRemovePagesFormData = (
  parameters: RemovePagesParameters,
  file: File,
): FormData =>
  objectToFormData(removePagesToApiParams(parameters), { fileInput: file });

export const removePagesOperationConfig = defineCustomTool<RemovePagesParameters>({
  validateParams: validateRemovePagesParameters,
  operationType: "removePages",
  defaultParameters,
  customProcessor: async (params, files) => {
    const output: File[] = [];
    for (const file of files) {
      const bytes = await removePagesLocally(new Uint8Array(await file.arrayBuffer()), params.pageNumbers);
      output.push(new File([new Uint8Array(bytes)], file.name.replace(/\.pdf$/i, "") + "_paginas_removidas.pdf", { type: "application/pdf" }));
    }
    return { files: output };
  },
});

export const useRemovePagesOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<RemovePagesParameters>({
    ...removePagesOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("removePages.error.failed", "Failed to remove pages"),
    ),
  });
};
