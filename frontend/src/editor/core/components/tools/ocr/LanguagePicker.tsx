import React, { useState, useEffect } from "react";
import { Text, Loader, Button, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  getAutoOcrLanguage,
  getBrowserLanguagesForOcr,
  getOcrDisplayName,
} from "@editor/utils/languageMapping";
import apiClient from "@editor/services/apiClient";
import DropdownListWithFooter, {
  DropdownItem,
} from "@editor/components/shared/DropdownListWithFooter";

export interface LanguageOption {
  value: string;
  label: string;
}

export interface LanguagePickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  languagesEndpoint?: string;
  autoFillFromBrowserLanguage?: boolean;
}

const LanguagePicker: React.FC<LanguagePickerProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  label,
  languagesEndpoint = "/api/v1/ui-data/ocr-pdf",
  autoFillFromBrowserLanguage = true,
}) => {
  const { t, i18n } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("dropdownList.selectLanguages");
  const [availableLanguages, setAvailableLanguages] = useState<DropdownItem[]>(
    [],
  );
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(true);
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const fetchLanguages = async () => {
      setIsLoadingLanguages(true);
      setLoadError(null);
      try {
        let languages: string[] = [];
        let firstError: unknown;
        try {
          const response = await apiClient.get<{ languages: string[] }>(languagesEndpoint);
          languages = Array.isArray(response.data?.languages) ? response.data.languages : [];
        } catch (error) {
          firstError = error;
        }

        // In desktop builds the generic operation router can reject an early
        // request as "backend offline" even though the Java server is already
        // listening on a dynamically assigned loopback port. The local OCR
        // metadata is safe to request directly, with the corporate proxy bypassed.
        if (languages.length === 0) {
          const { isTauri } = await import("@tauri-apps/api/core");
          if (isTauri()) {
            const { tauriBackendService } = await import("@editor/services/tauriBackendService");
            const backendUrl = tauriBackendService.getBackendUrl();
            if (backendUrl) {
              const { fetch } = await import("@tauri-apps/plugin-http");
              const response = await fetch(`${backendUrl}${languagesEndpoint}`, {
                method: "GET",
                connectTimeout: 5000,
                proxy: { noProxy: "localhost,127.0.0.1,::1" },
              });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const payload = await response.json() as { languages?: string[] };
              languages = Array.isArray(payload.languages) ? payload.languages : [];
            }
          }
        }

        if (cancelled) return;
        if (languages.length === 0) {
          throw firstError instanceof Error
            ? firstError
            : new Error("O backend não retornou idiomas OCR");
        }

        const displayNames =
          typeof Intl.DisplayNames !== "undefined"
            ? new Intl.DisplayNames([i18n.language], { type: "language" })
            : null;
        const languageOptions = [...new Set(languages)].map((lang) => {
          const displayName = getOcrDisplayName(lang);
          const browserLanguageCodes = getBrowserLanguagesForOcr(lang);
          const langKey = `lang.${lang}`;
          const translatedFromKey = t(langKey);
          const hasKeyTranslation = translatedFromKey !== langKey;
          const intlTranslatedName = displayNames
            ? browserLanguageCodes
                .map((code) => displayNames.of(code))
                .find((name): name is string => Boolean(name))
            : null;
          const translatedName =
            (hasKeyTranslation ? translatedFromKey : null) ||
            intlTranslatedName ||
            t(`ocr.languages.${lang}`, displayName);
          return { value: lang, name: translatedName, label: translatedName };
        }).sort((left, right) => left.name.localeCompare(right.name, i18n.language));
        setAvailableLanguages(languageOptions);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        console.warn("[LanguagePicker] Could not load OCR languages", error);
        setLoadError("Não foi possível consultar os idiomas do OCR.");
        setAvailableLanguages([]);
        // The backend can become ready after the first request. Retry without
        // requiring the user to close and reopen the tool.
        retryTimer = setTimeout(() => setRetryCount(count => count + 1), 5000);
      } finally {
        if (!cancelled) setIsLoadingLanguages(false);
      }
    };
    void fetchLanguages();
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [languagesEndpoint, i18n.language, t, retryCount]);

  // Auto-fill OCR language based on browser language when languages are loaded
  useEffect(() => {
    const shouldAutoFillLanguage =
      autoFillFromBrowserLanguage &&
      !isLoadingLanguages &&
      availableLanguages.length > 0 &&
      !hasAutoFilled &&
      value.length === 0;

    if (shouldAutoFillLanguage) {
      // Use the comprehensive language mapping from languageMapping.ts
      const suggestedOcrLanguages = getAutoOcrLanguage(i18n.language);

      if (suggestedOcrLanguages.length > 0) {
        // Find the first suggested language that's available in the backend
        const matchingLanguage = availableLanguages.find((lang) =>
          suggestedOcrLanguages.includes(lang.value),
        );

        if (matchingLanguage) {
          onChange([matchingLanguage.value]);
        }
      }

      setHasAutoFilled(true);
    }
  }, [
    autoFillFromBrowserLanguage,
    isLoadingLanguages,
    availableLanguages,
    hasAutoFilled,
    value.length,
    i18n.language,
    onChange,
  ]);

  if (isLoadingLanguages) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Loader size="xs" />
        <Text size="sm">
          {t("ocr.languagePicker.loading", "Loading available languages...")}
        </Text>
      </div>
    );
  }

  const footer = (
    <> 
      {loadError && (
        <Stack gap={4} align="center" mb="xs">
          <Text c="red" size="xs">{loadError}</Text>
          <Button size="compact-xs" variant="light" onClick={() => setRetryCount(count => count + 1)}>
            Tentar novamente
          </Button>
        </Stack>
      )}
      <div className="flex flex-col items-center gap-1 text-center">
        <Text size="xs" c="dimmed" className="text-center">
          {t(
            "ocr.languagePicker.additionalLanguages",
            "Looking for additional languages?",
          )}
        </Text>
        <Text
          size="xs"
          style={{
            color: "var(--c-accent-text)",
            cursor: "pointer",
            textDecoration: "underline",
            textAlign: "center",
          }}
          onClick={() =>
            window.open(
              "https://docs.stirlingpdf.com/Configuration/OCR",
              "_blank",
            )
          }
        >
          {t("ocr.languagePicker.viewSetupGuide", "View setup guide →")}
        </Text>
      </div>
    </>
  );

  return (
    <DropdownListWithFooter
      value={value}
      onChange={(newValue) => onChange(newValue as string[])}
      items={availableLanguages}
      placeholder={resolvedPlaceholder}
      disabled={disabled}
      label={label}
      footer={footer}
      multiSelect={true}
      maxHeight={300}
      searchable={true}
    />
  );
};

export default LanguagePicker;
