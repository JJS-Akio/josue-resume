export default function Home() {
  return (
    <section className="flex flex-col gap-10">
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold text-white sm:text-5xl">
          Build private-first RAG demos.
        </h1>
        <p className="max-w-3xl text-base text-slate-300 sm:text-lg">
          This playground keeps every file in-memory so you can experiment with
          embeddings without sharing data with a backend. Start with the RAG
          example to see how uploads turn into embeddings you can inspect.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/rag"
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Open the RAG example
          </a>
          <p className="text-sm text-slate-400">
            Upload PDFs, DOCX, or plain text files and inspect the chunks.
          </p>
        </div>
      </div>

      <div className="grid gap-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-sm text-slate-300 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-white">
            How this repo is structured
          </h2>
          <ul className="space-y-2">
            <li>
              <span className="font-semibold text-indigo-300">FE only:</span>{" "}
              all extraction and embedding work happens in the browser.
            </li>
            <li>
              <span className="font-semibold text-indigo-300">No storage:</span>{" "}
              refresh the tab to flush everything from memory.
            </li>
            <li>
              <span className="font-semibold text-indigo-300">Extendable:</span>{" "}
              add your own similarity search or vector store integrations later.
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-white">Next steps</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open the RAG example and upload a supported file.</li>
            <li>Inspect the generated chunks and embedding previews.</li>
            <li>
              Extend the flow with your similarity search or chat UI when ready.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
