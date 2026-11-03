import { useTranslation } from "react-i18next";
import {
  defineCustomTool,
  useToolOperation,
  CustomProcessorResult,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateExtractPagesParameters,
  ExtractPagesParameters,
  defaultParameters,
} from "@editor/hooks/tools/extractPages/useExtractPagesParameters";
import { parseSelectionWithDiagnostics } from "@editor/utils/bulkselection/parseSelection";
import { extractPagesLocally } from "@editor/utils/localPdfPages";
import { PDFDocument } from "@cantoo/pdf-lib";

export const extractPagesOperationConfig = defineCustomTool({
  validateParams: validateExtractPagesParameters,
  operationType: "extractPages",
  customProcessor: async (
    parameters: ExtractPagesParameters,
    files: File[],
  ): Promise<CustomProcessorResult> => {
    const outputs: File[] = [];

    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const source = await PDFDocument.load(bytes);
      const selected = parseSelectionWithDiagnostics(parameters.pageNumbers, source.getPageCount(), { strict: true }).pages;
      if (selected.length === 0) throw new Error("Nenhuma página válida selecionada");
      const outputBytes = await extractPagesLocally(bytes, selected);
      const base = (file.name || "document.pdf").replace(/\.[^.]+$/, "");
      const outFile = new File([new Uint8Array(outputBytes)], `${base}_extracted_pages.pdf`, {
        type: "application/pdf",
      });
      outputs.push(outFile);
    }

    return {
      files: outputs,
      consumedAllInputs: false,
    };
  },
  defaultParameters,
});

export const useExtractPagesOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<ExtractPagesParameters>({
    ...extractPagesOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("extractPages.error.failed", "Failed to extract pages"),
    ),
  });
};
