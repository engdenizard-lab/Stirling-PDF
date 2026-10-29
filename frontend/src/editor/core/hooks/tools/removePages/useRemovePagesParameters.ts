import { BaseParameters } from "@editor/types/parameters";
import {
  useBaseParameters,
  BaseParametersHook,
} from "@editor/hooks/tools/shared/useBaseParameters";


export interface RemovePagesParameters extends BaseParameters {
  pageNumbers: string; // comma-separated page numbers or ranges (e.g., "1,3,5-8")
}

export const defaultParameters: RemovePagesParameters = {
  pageNumbers: "",
};

export type RemovePagesParametersHook =
  BaseParametersHook<RemovePagesParameters>;

/** Whether these parameters are complete enough to run. Shared by the tool's settings hook
 * and its operationConfig, so the editor and the pipeline builder agree. */
export function validateRemovePagesParameters(
  params: RemovePagesParameters,
): boolean {
  // Offline processing supports explicit pages/ranges only. Mathematical
  // expressions and open ranges belong to the backend implementation.
  const parts = params.pageNumbers.split(",").map(part => part.trim());
  return parts.length > 0 &&
    parts.every(part => /^[1-9]\d*(?:-[1-9]\d*)?$/.test(part));
}

export const useRemovePagesParameters = (): RemovePagesParametersHook => {
  return useBaseParameters({
    defaultParameters,
    endpointName: "remove-pages",
    validateFn: validateRemovePagesParameters,
  });
};
