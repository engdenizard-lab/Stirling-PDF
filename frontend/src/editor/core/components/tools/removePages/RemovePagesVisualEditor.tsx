import { useEffect, useRef, useState } from "react";
import { Badge, Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { StirlingFile } from "@editor/types/fileContext";
import { thumbnailGenerationService } from "@editor/services/thumbnailGenerationService";
import { parseLocalPageSelection } from "@editor/utils/localPdfPages";

interface Props {
  opened: boolean;
  onClose: () => void;
  file: StirlingFile | null;
  selection: string;
  onSelectionChange: (pages: string) => void;
}

export default function RemovePagesVisualEditor({
  opened, onClose, file, selection, onSelectionChange,
}: Props) {
  const [total, setTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
  const [pagePreview, setPagePreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [thumbnailsReady, setThumbnailsReady] = useState(false);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);
  const loadSequenceRef = useRef(0);
  const previewSequenceRef = useRef(0);
  const selected = (() => {
    try { return new Set(parseLocalPageSelection(selection, total)); }
    catch { return new Set<number>(); }
  })();

  useEffect(() => {
    if (!opened || !file) return;
    let cancelled = false;
    const sequence = ++loadSequenceRef.current;
    setTotal(0);
    setActivePage(1);
    setThumbnails({});
    setThumbnailsReady(false);
    setSelectionWarning(null);
    setPagePreview(null);
    setError(null);
    bytesRef.current = null;
    void (async () => {
      try {
        const bytes = await file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        if (cancelled || loadSequenceRef.current !== sequence) return;
        bytesRef.current = bytes;
        const count = pdf.getPageCount();
        setTotal(count);
        const numbers = Array.from({ length: count }, (_, i) => i + 1);
        await thumbnailGenerationService.generateThumbnails(
          file.fileId, bytes, numbers, { scale: 0.15, quality: 0.72 },
          progress => {
            if (!cancelled && loadSequenceRef.current === sequence)
              setThumbnails(old => ({
                ...old,
                ...Object.fromEntries(progress.thumbnails
                  .filter(item => item.success)
                  .map(item => [item.pageNumber, item.thumbnail])),
              }));
          },
        );
        if (!cancelled && loadSequenceRef.current === sequence) setThumbnailsReady(true);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
    return () => { cancelled = true; loadSequenceRef.current++; bytesRef.current = null; };
  }, [opened, file?.fileId]);

  useEffect(() => {
    if (!opened || !file || !bytesRef.current || total < 1 || !thumbnailsReady) return;
    let cancelled = false;
    const sequence = ++previewSequenceRef.current;
    setLoadingPreview(true);
    setPagePreview(null);
    void thumbnailGenerationService.generateThumbnails(
      file.fileId, bytesRef.current, [activePage], { scale: 0.95, quality: 0.9 },
    ).then(results => {
      if (!cancelled && previewSequenceRef.current === sequence) {
        setPagePreview(results[0]?.thumbnail || null);
        if (!results[0]?.success) setError(results[0]?.error || "Não foi possível visualizar esta página.");
      }
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    }).finally(() => {
      if (!cancelled && previewSequenceRef.current === sequence) setLoadingPreview(false);
    });
    return () => { cancelled = true; previewSequenceRef.current++; };
  }, [opened, file?.fileId, activePage, total, thumbnailsReady]);

  const togglePage = (page: number) => {
    setSelectionWarning(null);
    const next = new Set(selected);
    if (next.has(page)) next.delete(page);
    else next.add(page);
    if (next.size >= total) {
      setSelectionWarning("É necessário manter pelo menos uma página no PDF.");
      return;
    }
    onSelectionChange([...next].sort((a, b) => a - b).join(","));
  };

  return (
    <Modal opened={opened} onClose={onClose} size="90%" centered
      title="Remover páginas — visualização" styles={{
        content: { maxWidth: 1250 },
        body: { padding: 12 },
      }}>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm">Selecione uma miniatura para ampliar. Use a lixeira para marcar ou desmarcar a exclusão.</Text>
          <Badge color={selected.size ? "red" : "gray"}>
            {selected.size} de {total} marcada(s)
          </Badge>
        </Group>
        {error && <Text c="red" size="sm" role="alert">{error}</Text>}
        {selectionWarning && <Text c="orange" size="sm" role="alert">{selectionWarning}</Text>}
        <div style={{ display: "flex", gap: 12, height: "min(70vh, 680px)", minHeight: 310 }}>
          <aside aria-label="Miniaturas das páginas" style={{
            width: 185, flexShrink: 0, overflowY: "auto",
            borderRight: "1px solid var(--c-border-subtle)", paddingRight: 8,
          }}>
            {Array.from({ length: total }, (_, i) => i + 1).map(page => (
              <div key={page} style={{
                padding: 6, marginBottom: 8, borderRadius: 6,
                border: page === activePage ? "2px solid var(--mantine-primary-color-filled)" : "1px solid var(--c-border-subtle)",
                opacity: selected.has(page) ? 0.55 : 1,
              }}>
                <button type="button" onClick={() => setActivePage(page)}
                  aria-label={`Visualizar página ${page}`}
                  style={{ background: "transparent", border: 0, padding: 0, width: "100%", cursor: "pointer" }}>
                  {thumbnails[page]
                    ? <img src={thumbnails[page]} alt={`Página ${page}`}
                        style={{ height: 118, width: "100%", objectFit: "contain" }} />
                    : <div style={{ height: 118, display: "grid", placeItems: "center" }}>Página {page}</div>}
                </button>
                <Group justify="space-between" gap={4} wrap="nowrap">
                  <Text size="xs">Página {page}</Text>
                  <Button type="button" size="compact-xs" variant={selected.has(page) ? "filled" : "light"}
                    color={selected.has(page) ? "red" : "gray"}
                    onClick={() => togglePage(page)}
                    aria-label={selected.has(page) ? `Restaurar página ${page}` : `Excluir página ${page}`}>
                    {selected.has(page) ? "Restaurar" : "Excluir"}
                  </Button>
                </Group>
              </div>
            ))}
          </aside>
          <section aria-label="Visualização da página" style={{
            flex: 1, minWidth: 0, overflow: "auto", display: "flex",
            alignItems: "flex-start", justifyContent: "center",
            background: "var(--c-surface)", padding: 8,
          }}>
            {loadingPreview || !thumbnailsReady ? <Loader aria-label="Carregando página" /> :
              pagePreview ? <img src={pagePreview} alt={`Visualização completa da página ${activePage}`}
                style={{ maxWidth: "100%", height: "auto", objectFit: "contain" }} /> :
                <Text c="dimmed" size="sm">Carregando documento...</Text>}
          </section>
        </div>
        <Group justify="space-between">
          <Text size="xs" c="dimmed">As páginas só serão removidas ao executar “Remover páginas” na ferramenta.</Text>
          <Button onClick={onClose}>Concluir seleção</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
