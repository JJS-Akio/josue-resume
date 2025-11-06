import { convertTextToEmbedding, TextToVectorDTO } from "./vector-service";

type PdfPageProxy = {
  getTextContent: () => Promise<{
    items: Array<{ str?: string }>;
  }>;
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => void;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocumentProxy>;
  destroy: () => void;
};

type PdfJsModule = {
  GlobalWorkerOptions?: {
    workerSrc: string;
  };
  getDocument: (params: { data: Uint8Array }) => PdfLoadingTask;
};

export async function convertFileToEmbeddings(
  file: File
): Promise<TextToVectorDTO[]> {
  const fileContents = await extractFileData(file);
  const chunks = chunkStringWithWindow(fileContents);

  const embeddings: TextToVectorDTO[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    embeddings.push(await convertTextToEmbedding(chunk));
  }

  return embeddings;
}

function chunkStringWithWindow(str: string): string[] {
  const chunks: string[] = [];
  const step = 100;
  const windowSize = 500;

  for (let i = 0; i < str.length; i += step) {
    const chunk = str.slice(i, i + windowSize);
    chunks.push(chunk);
  }

  return chunks;
}

async function extractFileData(file: File): Promise<string> {
  const extension = getFileExtension(file.name);

  if (
    extension === "txt" ||
    extension === "md" ||
    extension === "json" ||
    file.type.startsWith("text/")
  ) {
    return file.text();
  }

  if (extension === "pdf" || file.type === "application/pdf") {
    return extractPdfText(file);
  }

  if (
    extension === "docx" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(file);
  }

  throw new Error(
    `Unsupported file type: ${extension || file.type || "unknown"}`
  );
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot + 1).toLowerCase();
}

async function extractPdfText(file: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("PDF extraction is only supported in the browser");
  }

  const pdfModuleUrl = `${window.location.origin}/pdf.min.mjs`;
  const pdfjs = (await import(
    /* webpackIgnore: true */
    pdfModuleUrl
  )) as PdfJsModule;
  if (typeof pdfjs.GlobalWorkerOptions !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const data = new Uint8Array(await file.arrayBuffer());

  const loadingTask = pdfjs.getDocument({
    data,
  });

  const doc = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: { str?: string }) => ("str" in item && item.str ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  doc.destroy();
  loadingTask.destroy();

  return pages.join("\n\n");
}

let mammothModulePromise:
  | Promise<typeof import("mammoth/mammoth.browser")>
  | null = null;

async function loadMammoth() {
  if (!mammothModulePromise) {
    mammothModulePromise = import("mammoth/mammoth.browser");
  }
  return mammothModulePromise;
}

async function extractDocxText(file: File): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("DOCX extraction is only supported in the browser");
  }

  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}
