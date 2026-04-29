declare module 'mailparser' {
  export function simpleParser(input: string | Buffer): Promise<any>
}

declare module 'nodemailer' {
  const nodemailer: {
    createTransport: (...args: any[]) => any
  }
  export default nodemailer
}

declare module 'pdfkit' {
  const PDFDocument: any
  export default PDFDocument
}