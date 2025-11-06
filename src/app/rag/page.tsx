'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from "react";
import { convertFileToEmbeddings } from "@/lib/vector/convert";
import type { TextToVectorDTO } from "@/lib/vector/vector-service";
import type { Tensor } from "@huggingface/transformers";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "md", "json"];

type ToastState =
  | { variant: "error" | "info"; message: string }
  | null;

function tensorToArray(tensor: Tensor): number[] {
  const data = (tensor as unknown as { data?: unknown }).data;
  if (!data) return [];
  if (Array.isArray(data)) {
    return data.map((value) => Number(value));
  }
  if (ArrayBuffer.isView(data)) {
    return Array.from(
      data as unknown as ArrayLike<number>
    ).map((value) => Number(value));
  }
  if (typeof data === "object" && data !== null && "toArray" in data) {
    try {
      return Array.from((data as { toArray: () => ArrayLike<number> }).toArray());
    } catch {
      return [];
    }
  }
  return [];
}

export default function RagExamplePage() {
  const [vectors, setVectors] = useState<TextToVectorDTO[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [toast, setToast] = useState<ToastState>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>(
    {}
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const allowedList = useMemo(
    () => ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(", "),
    []
  );

  const normalizedSearchTokens = useMemo(
    () => parseTokens(searchInput).map((token) => token.toLowerCase()),
    [searchInput]
  );

  const searchTokens = useMemo(() => parseTokens(searchInput), [searchInput]);

  useEffect(() => {
    setExpandedChunks({});
  }, [normalizedSearchTokens.join("|")]);

  const filteredChunks = useMemo(() => {
    return vectors
      .map((item, originalIndex) => {
        const lower = item.text.toLowerCase();
        let matchCount = 0;
        if (normalizedSearchTokens.length) {
          for (const token of normalizedSearchTokens) {
            const regex = new RegExp(escapeRegExp(token), "gi");
            const matches = lower.match(regex);
            if (matches) {
              matchCount += matches.length;
            }
          }
        }
        return { item, originalIndex, matchCount };
      })
      .filter(
        (entry) =>
          normalizedSearchTokens.length === 0 || entry.matchCount > 0
      )
      .sort((a, b) => {
        if (!normalizedSearchTokens.length) {
          return a.originalIndex - b.originalIndex;
        }
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }
        return a.originalIndex - b.originalIndex;
      });
  }, [vectors, normalizedSearchTokens]);

  const totalChunks = filteredChunks.length;

  useEffect(() => {
    if (totalChunks === 0) {
      setVisibleCount((prev) => (prev === 0 ? prev : 0));
      return;
    }
    setVisibleCount((prev) => {
      if (prev === 0) {
        return Math.min(10, totalChunks);
      }
      if (prev > totalChunks) {
        return totalChunks;
      }
      return prev;
    });
  }, [totalChunks]);

  const sizeOptions = useMemo(() => {
    if (totalChunks === 0) return [];
    const base = [10, 20, 30];
    const options = base
      .filter((value) => value < totalChunks)
      .concat(totalChunks)
      .filter((value, index, array) => array.indexOf(value) === index);
    return options;
  }, [totalChunks]);

  const displayCount =
    totalChunks === 0
      ? 0
      : Math.min(visibleCount === 0 ? totalChunks : visibleCount, totalChunks);
  const visibleChunks = filteredChunks.slice(0, displayCount);
  const hasHiddenChunks = displayCount < totalChunks;

  useEffect(() => {
    if (!normalizedSearchTokens.length) return;
    for (const entry of visibleChunks) {
      const chunkId = String(entry.originalIndex);
      const container = textContainerRefs.current[chunkId];
      if (!container) continue;
      const highlightEl = container.querySelector(
        "[data-highlight='true']"
      ) as HTMLElement | null;
      if (highlightEl) {
        highlightEl.scrollIntoView({ block: "center", behavior: "smooth" });
        break;
      }
    }
  }, [normalizedSearchTokens, visibleChunks]);

  const reset = useCallback(() => {
    setVectors([]);
    setFileName(null);
    setStatusMessage("");
    setVisibleCount(10);
    setSearchInput("");
    setExpandedChunks({});
    textContainerRefs.current = {};
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setToast({ variant: "info", message: "Cleared uploaded file and embeddings." });
  }, []);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key === "Backspace" &&
        searchInput.length === 0 &&
        searchTokens.length
      ) {
        event.preventDefault();
        const updated = searchTokens.slice(0, searchTokens.length - 1);
        setSearchInput(updated.join(" "));
      }
    },
    [searchInput, searchTokens]
  );

  const handleRemoveToken = useCallback((target: string) => {
    setSearchInput((prev) => {
      const filtered = parseTokens(prev).filter(
        (token) => token.toLowerCase() !== target.toLowerCase()
      );
      return filtered.join(" ");
    });
  }, []);

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file || isProcessing || vectors.length) return;

      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        setToast({
          variant: "error",
          message: `Unsupported file type. Please upload one of: ${allowedList}`,
        });
        return;
      }

      setSearchInput("");
      setExpandedChunks({});
      setVisibleCount(10);
      setIsProcessing(true);
      setStatusMessage("Preparing the embedding model…");
      try {
        const result = await convertFileToEmbeddings(file);
        textContainerRefs.current = {};
        setVectors(result);
        setFileName(file.name);
        setVisibleCount(result.length === 0 ? 0 : Math.min(10, result.length));
        setStatusMessage("");
        setToast({
          variant: "info",
          message: `Processed ${result.length} chunk${result.length === 1 ? "" : "s"} from ${file.name}.`,
        });
      } catch (error) {
        console.error(error);
        setStatusMessage("");
        setToast({
          variant: "error",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while processing the file.",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [allowedList, isProcessing, vectors.length]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      void handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (isProcessing || vectors.length) return;
    setIsDragActive(true);
  }, [isProcessing, vectors.length]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      setIsDragActive(false);
      if (isProcessing || vectors.length) return;
      const file = event.dataTransfer.files?.[0] ?? null;
      void handleFile(file);
    },
    [handleFile, isProcessing, vectors.length]
  );

  const isUploadDisabled = isProcessing || vectors.length > 0;

  return (
    <section className="flex flex-col gap-10">
      <div className="rounded-3xl border border-zinc-200 bg-[#FAFAFA] p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Retrieval-Augmented Generation (RAG) Playground
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          Upload a supported document and we&apos;ll keep it entirely in the browser,
          split it into overlapping windows, and generate embeddings for each chunk.
          Explore how chunking, embeddings, and similarity search fit together—no backends
          or third-party services involved.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-6 shadow-sm">
        <div>
          <p className="text-sm text-slate-700">
            Currently supported extensions:{" "}
            <span className="font-medium text-indigo-600">{allowedList}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            All processing happens client-side. Refreshing clears everything.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600"
          >
            View upload limits
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!vectors.length && !fileName}
            className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-200 disabled:text-white/70"
          >
            Reset
          </button>
        </div>
      </div>

      <label
        htmlFor="file-upload"
        className={[
          "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-white text-slate-700 transition",
          isUploadDisabled
            ? "border-zinc-300 bg-zinc-200 text-zinc-500"
            : isDragActive
            ? "border-indigo-300 bg-indigo-50 text-indigo-700"
            : "border-zinc-400 hover:border-indigo-400 hover:bg-white",
        ].join(" ")}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          onChange={handleInputChange}
          className="sr-only"
          disabled={isUploadDisabled}
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            {isUploadDisabled ? "Upload complete" : "Upload a document"}
          </span>
          <p className="max-w-md text-sm text-slate-600">
            {isProcessing
              ? "Processing file and generating embeddings. This can take a little while the first time."
              : vectors.length
              ? `Processed ${vectors.length} chunk${vectors.length === 1 ? "" : "s"} from ${fileName}. Use reset to start over.`
              : "Drag & drop a supported file here, or click to choose one from your device."}
          </p>
          {isProcessing && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
              <p className="text-xs text-indigo-600">
                {statusMessage || "Hang tight, downloading the model and generating embeddings…"}
              </p>
            </div>
          )}
        </div>
      </label>

      {vectors.length > 0 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-900">
              Chunk explorer
            </h2>
            <p className="text-sm text-slate-600">
              Each card shows the chunked text we generated along with a preview of
              its embedding vector. Expand a card to inspect the full embedding values.
            </p>
          </div>
          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-zinc-300 bg-white px-4 py-3">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Type to search chunks in real time…"
                  className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                disabled={!searchInput.trim()}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {searchTokens.length === 0 ? (
                <span className="text-xs text-slate-500">
                  Keywords appear here as you type. Matching text in the chunks
                  will be highlighted automatically.
                </span>
              ) : (
                searchTokens.map((token) => (
                  <span
                    key={token}
                    className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700"
                  >
                    {token}
                    <button
                      type="button"
                      onClick={() => handleRemoveToken(token)}
                      className="text-indigo-600 transition hover:text-indigo-800"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            {totalChunks > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Showing {displayCount} of {totalChunks} chunk
                  {totalChunks === 1 ? "" : "s"}
                  {searchTokens.length
                    ? ` matching ${searchTokens.join(", ")}`
                    : ""}
                </span>
                {sizeOptions.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {sizeOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setVisibleCount(option)}
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          visibleCount === option ||
                          (option === totalChunks && visibleCount === totalChunks)
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-zinc-200 bg-white text-slate-700 hover:border-indigo-200",
                        ].join(" ")}
                      >
                        {option === totalChunks ? `All (${totalChunks})` : option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {filteredChunks.length === 0 ? (
            <div className="rounded-3xl border border-zinc-200 bg-[#FAFAFA] p-8 text-center text-sm text-slate-600">
              No chunks match your search terms. Try different keywords or reset the
              filters.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleChunks.map((entry, index) => {
                const { item, originalIndex, matchCount } = entry;
                const chunkId = String(originalIndex);
                const manualState = expandedChunks[chunkId];
                const defaultExpanded = normalizedSearchTokens.length > 0;
                const isExpanded =
                  manualState !== undefined ? manualState : defaultExpanded;
                const vectorArray = tensorToArray(item.vectors);
                const preview = vectorArray
                  .slice(0, 8)
                  .map((value) => value.toFixed(4))
                  .join(", ");
                const fullVector =
                  vectorArray.length > 0
                    ? vectorArray.map((value) => value.toFixed(6)).join(", ")
                    : "No embedding data available.";
                const highlightedText = highlightMatches(
                  item.text,
                  normalizedSearchTokens
                );

                return (
                  <article
                    key={`${chunkId}-${index}`}
                    className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-[#FAFAFA] p-6 shadow-sm shadow-zinc-300/60"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-600">
                        Chunk {originalIndex + 1}
                      </span>
                      <span className="text-xs text-slate-500">
                        {vectorArray.length} dims
                      </span>
                    </div>
                    <div className="mt-4 flex-1 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Source text
                        </h3>
                        <div className="flex items-center gap-2">
                          {matchCount > 0 && (
                            <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                              {matchCount} hit{matchCount === 1 ? "" : "s"}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedChunks((prev) => ({
                                ...prev,
                                [chunkId]: !isExpanded,
                              }))
                            }
                            className="text-xs font-medium text-indigo-600 transition hover:text-indigo-800"
                          >
                            {isExpanded ? "Collapse" : "Expand"}
                          </button>
                        </div>
                      </div>
                      <div
                        ref={(node) => {
                          if (node) {
                            textContainerRefs.current[chunkId] = node;
                          } else {
                            delete textContainerRefs.current[chunkId];
                          }
                        }}
                        className={[
                          "rounded-2xl border border-zinc-100 bg-white p-4 text-sm leading-6 text-slate-700 whitespace-pre-wrap",
                          isExpanded
                            ? "max-h-96 overflow-y-auto"
                            : "max-h-48 overflow-y-auto",
                        ].join(" ")}
                      >
                        {highlightedText}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Embedding preview
                        </h4>
                        <p className="rounded-2xl border border-zinc-100 bg-white p-3 text-xs text-slate-700">
                          {preview || "—"}
                        </p>
                        <details className="group rounded-2xl border border-zinc-200 bg-white p-3 text-xs text-slate-700">
                          <summary className="cursor-pointer list-none font-medium text-indigo-700 transition group-open:text-indigo-900">
                            View complete vector
                          </summary>
                          <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-[11px] text-slate-700">
                            {fullVector}
                          </pre>
                        </details>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {hasHiddenChunks && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  const nextOption = sizeOptions.find(
                    (option) => option > displayCount
                  );
                  if (nextOption) {
                    setVisibleCount(nextOption);
                  } else {
                    setVisibleCount(totalChunks);
                  }
                }}
                className="rounded-full border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:text-indigo-900"
              >
                Show more
              </button>
            </div>
          )}
        </div>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-lg shadow-black/20">
            <h2 className="text-lg font-semibold text-slate-900">Upload requirements</h2>
            <p className="mt-3 text-sm text-slate-600">
              We currently accept the following file types:{" "}
              <span className="font-medium text-indigo-600">{allowedList}</span>.
              Everything stays in-memory—closing or refreshing the page clears all data.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Larger PDFs will take longer to process. Try to keep uploads under a few megabytes for the smoothest experience.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={[
            "fixed bottom-6 right-6 z-50 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg",
            toast.variant === "error"
              ? "bg-red-500/90 text-white"
              : "bg-slate-900 text-white",
          ].join(" ")}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:text-white"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}

function parseTokens(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) return false;
      const lower = token.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatches(
  text: string,
  normalizedTokens: string[]
): ReactNode {
  if (!normalizedTokens.length) {
    return text;
  }

  const uniqueTokens = Array.from(
    new Set(normalizedTokens.filter(Boolean))
  ).map((token) => token.toLowerCase());
  if (!uniqueTokens.length) {
    return text;
  }

  const pattern = new RegExp(
    `(${uniqueTokens.map(escapeRegExp).join("|")})`,
    "gi"
  );

  const parts = text.split(pattern);
  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    const isMatch = uniqueTokens.includes(lower);
    if (isMatch) {
      return (
        <mark
          key={`match-${index}`}
          data-highlight="true"
          className="rounded bg-indigo-100 px-1 py-0.5 text-indigo-900"
        >
          {part}
        </mark>
      );
    }
    if (!part) {
      return null;
    }
    return <span key={`text-${index}`}>{part}</span>;
  });
}
