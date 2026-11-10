// O pdfjs-dist não publica tipos do worker; no servidor ele só é carregado em globalThis.pdfjsWorker (ver app/actions/extract-pdf.ts)
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs'
