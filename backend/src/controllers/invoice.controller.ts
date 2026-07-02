import { Request, Response } from 'express';
import { InvoiceService } from '../services/invoice.service';

export class InvoiceController {
  /**
   * Generates and exports the PDF invoice for a completed order.
   */
  public static async exportInvoice(req: Request, res: Response): Promise<void> {
    const requestingUserId = req.user!.userId;
    const { id } = req.params;

    const pdfBuffer = await InvoiceService.generateInvoicePdf(id, requestingUserId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id.slice(0, 8)}.pdf"`);
    res.status(200).send(pdfBuffer);
  }
}
