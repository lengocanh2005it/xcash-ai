declare module 'pdfmake' {
  export interface PdfFontDescriptor {
    normal?: string | Buffer;
    bold?: string | Buffer;
    italics?: string | Buffer;
    bolditalics?: string | Buffer;
  }

  export type PdfFontDictionary = Record<string, PdfFontDescriptor>;

  export default class PdfPrinter {
    constructor(fontDescriptors: PdfFontDictionary);
    createPdfKitDocument(docDefinition: Record<string, unknown>): NodeJS.ReadableStream & {
      end(): void;
    };
  }
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: Record<string, string>;
  export default vfs;
}
