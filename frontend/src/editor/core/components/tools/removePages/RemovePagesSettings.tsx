import { Button, Stack, TextInput, Text } from "@mantine/core";
import { useState } from "react";
import type { StirlingFile } from "@editor/types/fileContext";
import RemovePagesVisualEditor from "@editor/components/tools/removePages/RemovePagesVisualEditor";
import { useTranslation } from "react-i18next";
import { RemovePagesParameters } from "@editor/hooks/tools/removePages/useRemovePagesParameters";
import { validatePageNumbers } from "@editor/utils/pageSelection";

interface RemovePagesSettingsProps {
  parameters: RemovePagesParameters;
  onParameterChange: <K extends keyof RemovePagesParameters>(
    key: K,
    value: RemovePagesParameters[K],
  ) => void;
  disabled?: boolean;
  file?: StirlingFile | null;
}

const RemovePagesSettings = ({
  parameters,
  onParameterChange,
  disabled = false,
  file = null,
}: RemovePagesSettingsProps) => {
  const { t } = useTranslation();
  const [visualOpen, setVisualOpen] = useState(false);

  const handlePageNumbersChange = (value: string) => {
    // Allow user to type naturally - don't normalize input in real-time
    onParameterChange("pageNumbers", value);
  };

  // Check if current input is valid
  const isValid = validatePageNumbers(parameters.pageNumbers || "");
  const hasValue = (parameters?.pageNumbers?.trim().length ?? 0) > 0;

  return (
    <Stack gap="md">
      <Button variant="light" onClick={() => setVisualOpen(true)} disabled={disabled || !file} fullWidth>
        Selecionar páginas visualmente
      </Button>
      <Text size="xs" c="dimmed">Visualize cada página e marque as que deseja remover.</Text>
      <RemovePagesVisualEditor
        opened={visualOpen}
        onClose={() => setVisualOpen(false)}
        file={file}
        selection={parameters.pageNumbers}
        onSelectionChange={value => onParameterChange("pageNumbers", value)}
      />
      <TextInput
        label={t("removePages.pageNumbers.label", "Pages to Remove")}
        value={parameters.pageNumbers || ""}
        onChange={(event) => handlePageNumbersChange(event.currentTarget.value)}
        placeholder={t(
          "removePages.pageNumbers.placeholder",
          "e.g., 1,3,5-8,10",
        )}
        disabled={disabled}
        required
        error={
          hasValue && !isValid
            ? t(
                "removePages.pageNumbers.error",
                "Invalid page number format. Use numbers, ranges (1-5), or mathematical expressions (2n+1)",
              )
            : undefined
        }
      />
    </Stack>
  );
};

export default RemovePagesSettings;
