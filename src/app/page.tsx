export default function Home() {
  return (
    <section className="flex flex-col gap-10">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Josue Navigator
        </p>
        <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
          Build private-first RAG demos.
        </h1>
        <p className="max-w-3xl text-base text-slate-600 sm:text-lg">
          Explore your documents securely in the browser and see how the Josue Navigator
          flow chunks, embeds, and visualizes your data—no backend required.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/rag"
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
          >
            Open the RAG example
          </a>
          <p className="text-sm text-slate-600">
            Upload PDFs, DOCX, or plain text files and inspect the chunks.
          </p>
        </div>
      </div>

      <div className="grid gap-6 rounded-3xl border border-zinc-200 bg-[#FAFAFA] p-8 text-sm text-slate-700 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-slate-900">
            How this playground works
          </h2>
          <ul className="space-y-2">
            <li>
              <span className="font-semibold text-indigo-600">FE only:</span>{" "}
              everything runs locally in your browser tab.
            </li>
            <li>
              <span className="font-semibold text-indigo-600">No storage:</span>{" "}
              refresh the page to clear every vector and chunk.
            </li>
            <li>
              <span className="font-semibold text-indigo-600">Extendable:</span>{" "}
              swap in your favorite vector store or chat UI later.
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-slate-900">Next steps</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Upload a supported document in the RAG example.</li>
            <li>Search, expand, and inspect the generated embeddings.</li>
            <li>
              Apply the same pipeline to your own projects when ready.
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
