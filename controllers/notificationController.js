import admin from "../configs/firebase.js";
import cloudinary from "../configs/cloudinary.js";
import axios from "axios";
import streamifier from "streamifier";
import { invoiceEmail, sendEmailWithAttachments } from "../utils/sendEmail.js";
import { generatePadPDFWithPuppeteer, generateInvoicePDFWithPuppeteer } from "../utils/generatePDF_puppeteer.js";
import PadStatement from "../models/padStatementModel.js";
import Invoice from "../models/invoiceModel.js";

const notifyOneUser = async (req, res) => {
  try {
    const fcmToken = req.params.token;
    const { title, message } = req.body;
    const messageJson = {
      token: fcmToken,
      notification: {
        title: title,
        body: message,
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        status: "done",
      },
    };
    const response = await admin.messaging().send(messageJson);

    console.log("Notification sent:", response);
    res
      .status(200)
      .json({ success: true, message: "Notification sent", response });
  } catch (error) {
    console.error("Error sending FCM notification:", error.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to send notification",
        error: error.message,
      });
  }
};

const notifyAllUsers = async (req, res) => {
  try {
    const { title, message } = req.body;

    const messageJson = {
      topic: "all_users",
      notification: {
        title,
        body: message,
      },
      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        status: "done",
      },
    };

    const response = await admin.messaging().send(messageJson);

    console.log("Notification sent:", response);
    res
      .status(200)
      .json({ success: true, message: "Notification sent", response });
  } catch (error) {
    console.error("Error sending FCM notification:", error.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to send notification",
        error: error.message,
      });
  }
};

const sendPadStatementEmail = async (req, res) => {
  try {
    const { 
      receiverEmail, 
      subject = "pcIST Statement", 
      statement, 
      authorizers = [],
      contactEmail = '', 
      contactPhone = '', 
      address = 'Institute of Science & Technology (IST), Dhaka'
    } = req.body;
    
    if (!receiverEmail || !statement) {
      return res.status(400).json({ success: false, message: "receiverEmail and statement are required" });
    }

    // Ensure authorizers is an array (can be empty)
    if (!Array.isArray(authorizers)) {
      return res.status(400).json({ success: false, message: "authorizers must be an array" });
    }

    // Generate serial number before PDF generation to ensure consistency
    const today = new Date();
    const currentCount = await PadStatement.countDocuments({});
    const nextNumber = currentCount + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    const serial = `pcIST-${today.getFullYear()}-${paddedNumber}`;
    
    const dateStr = today.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Prepare parameters for PDF generation with pre-generated serial
    const pdfParams = {
      statement,
      contactEmail,
      contactPhone,
      address,
      authorizers,
      serial,  // Pass the pre-generated serial
      dateStr  // Pass the pre-generated date
    };

    // Use Puppeteer-based PDF generator
    const { buffer } = await generatePadPDFWithPuppeteer(pdfParams);

    // Save request to DB (raw data + generated metadata)
    const record = await PadStatement.create({
      receiverEmail,
      subject,
      statement,
      authorizers,
      contactEmail,
      contactPhone,
      address,
      serial,
      dateStr,
      createdBy: req.user?._id,
      sent: true,
      sentAt: new Date(),
    });

    const html = `<p>Dear recipient,</p>
      <p>Please find attached a formal statement from the Programming Club of IST.</p>
      <p>Serial: <strong>${serial}</strong><br/>Date: <strong>${dateStr}</strong></p>
      <p>Regards,<br/>pcIST</p>`;

    await sendEmailWithAttachments({
      emailTo: receiverEmail,
      subject,
      html,
      attachments: [
        {
          filename: `${serial}.pdf`,
          content: buffer,
        },
      ],
    });

    // Mark as sent
    record.sent = true;
    record.sentAt = new Date();
    await record.save();

    return res.status(200).json({ success: true, message: "Statement email sent", serial, date: dateStr, id: record._id });
  } catch (error) {
    console.error("Error sending statement email:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// (Removed separate puppeteer-only handler — main send route now uses Puppeteer.)

// List pad statement history
const listPadStatementHistory = async (req, res) => {
  try {
    const items = await PadStatement.find({})
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

const downloadPadStatementPDF = async (req, res) => {
  try {
    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: "statementPdf file is required" });
    }
    if (uploadedFile.mimetype !== "application/pdf") {
      return res.status(400).json({ success: false, message: "Only PDF files are accepted" });
    }

    // Parse optional fields (sent as multipart/form-data strings)
    const contactEmail = req.body.contactEmail || '';
    const contactPhone = req.body.contactPhone || '';
    const address = req.body.address || 'Institute of Science & Technology (IST), Dhaka';

    let authorizers = [];
    if (req.body.authorizers) {
      if (Array.isArray(req.body.authorizers)) {
        authorizers = req.body.authorizers
          .map((entry) => {
            if (typeof entry === 'string') {
              try {
                return JSON.parse(entry);
              } catch (parseError) {
                return null;
              }
            }
            return entry;
          })
          .filter(Boolean);
      } else {
        try {
          const parsed = JSON.parse(req.body.authorizers);
          authorizers = Array.isArray(parsed) ? parsed : [];
        } catch (parseError) {
          return res.status(400).json({ success: false, message: "authorizers must be a JSON array" });
        }
      }
    }

    // Normalize authorizer objects to expected shape
    authorizers = authorizers
      .filter(Boolean)
      .slice(0, 3)
      .map((a) => ({
        name: a.name || a.fullName || '',
        role: a.role || a.title || '',
      }))
      .filter((a) => a.name && a.role);

    // Generate serial number before PDF generation to ensure consistency
    const today = new Date();
    const currentCount = await PadStatement.countDocuments({});
    const nextNumber = currentCount + 1;
    const paddedNumber = nextNumber.toString().padStart(4, '0');
    const serial = `pcIST-${today.getFullYear()}-${paddedNumber}`;

    const dateStr = today.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const pdfParams = {
      statement: '',
      contactEmail,
      contactPhone,
      address,
      authorizers,
      serial,
      dateStr,
      uploadedPdfBuffer: uploadedFile.buffer,
    };

    const { buffer } = await generatePadPDFWithPuppeteer(pdfParams);

    const record = new PadStatement({
      receiverEmail: null,
      subject: "PDF Download",
      statement: null,
      authorizers,
      contactEmail,
      contactPhone,
      address,
      serial,
      dateStr,
      createdBy: req.user?._id,
      sent: false,
      downloadedAt: new Date(),
    });

    await record.save();

    try {
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "raw",
            folder: "pads",
            public_id: record._id.toString(),
            overwrite: true,
            format: "pdf",
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
      });

      record.pdfUrl = uploadResult.secure_url || uploadResult.url;
      record.pdfPublicId = uploadResult.public_id;
      await record.save();
    } catch (uploadError) {
      await record.deleteOne().catch(() => {});
      throw uploadError;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    return res.send(buffer);
  } catch (error) {
    console.error("Error generating PDF for download:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const sendInvoiceEmail = async (req, res) => {
  try {
    const { 
      receiverEmail, 
      subject = "Invoice from pcIST", 
      products = [], 
      authorizerName = '', 
      authorizerDesignation = '',
      contactEmail, 
      contactPhone, 
      address 
    } = req.body;

    if (!receiverEmail || !products || products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "receiverEmail and products array are required" 
      });
    }

    // Validate products structure
    for (const product of products) {
      if (!product.description || !product.unitPrice) {
        return res.status(400).json({ 
          success: false, 
          message: "Each product must have description and unitPrice" 
        });
      }
    }

    // Generate invoice PDF (new invoice, so no issueDate provided)
    const { buffer, serial, issueDateStr, generatedDateStr, grandTotal } = await generateInvoicePDFWithPuppeteer({
      products,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
      issueDate: null, // New invoice, will use current date as issue date
    });

    // Calculate product totals and prepare for database
    const processedProducts = products.map(product => {
      const quantity = product.quantity || 1;
      const unitPrice = parseFloat(product.unitPrice) || 0;
      const total = quantity * unitPrice;
      return {
        description: product.description,
        quantity,
        unitPrice,
        total
      };
    });

    // Save invoice to database
    const invoice = await Invoice.create({
      serial,
      products: processedProducts,
      grandTotal,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
      issueDate: new Date(), // Store the issue date as Date object
      dateStr: issueDateStr, // Store formatted issue date string
      createdBy: req.user?._id,
      sentViaEmail: true,
      sentAt: new Date(),
    });

    const html = `<p>Dear Sir/Madam,</p>
      <p>Please find attached your invoice from the Programming Club of IST.</p>
      <p><strong>Invoice #:</strong> ${serial}<br/>
      <strong>Issue Date:</strong> ${issueDateStr}<br/>
      <strong>Total Amount:</strong> ৳${grandTotal.toFixed(2)}</p>
      <p>Thank you for your business!</p>
      <p>Regards,<br/>Programming Club of IST</p>`;

    await sendEmailWithAttachments({
      emailTo: receiverEmail,
      subject,
      html,
      attachments: [
        {
          filename: `${serial}.pdf`,
          content: buffer,
        },
      ],
    });

    return res.status(200).json({ 
      success: true, 
      message: "Invoice email sent successfully", 
      invoiceId: invoice._id,
      serial, 
      issueDate: issueDateStr,
      total: grandTotal 
    });
  } catch (error) {
    console.error("Error sending invoice email:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const downloadInvoicePDF = async (req, res) => {
  try {
    const { 
      products = [], 
      authorizerName = '', 
      authorizerDesignation = '',
      contactEmail, 
      contactPhone, 
      address 
    } = req.body;

    if (!products || products.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "products array is required" 
      });
    }

    // Validate products structure
    for (const product of products) {
      if (!product.description || !product.unitPrice) {
        return res.status(400).json({ 
          success: false, 
          message: "Each product must have description and unitPrice" 
        });
      }
    }

    // Generate invoice PDF (new invoice, so no issueDate provided)
    const { buffer, serial, issueDateStr, generatedDateStr, grandTotal } = await generateInvoicePDFWithPuppeteer({
      products,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
      issueDate: null, // New invoice, will use current date as issue date
    });

    // Calculate product totals and prepare for database
    const processedProducts = products.map(product => {
      const quantity = product.quantity || 1;
      const unitPrice = parseFloat(product.unitPrice) || 0;
      const total = quantity * unitPrice;
      return {
        description: product.description,
        quantity,
        unitPrice,
        total
      };
    });

    // Save invoice to database for tracking
    const invoice = await Invoice.create({
      serial,
      products: processedProducts,
      grandTotal,
      authorizerName,
      authorizerDesignation,
      contactEmail,
      contactPhone,
      address,
      issueDate: new Date(), // Store the issue date as Date object
      dateStr: issueDateStr, // Store formatted issue date string
      createdBy: req.user?._id,
      sentViaEmail: false,
      downloadedAt: new Date(),
    });

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error generating invoice PDF for download:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const downloadPadStatementById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "PAD statement ID is required" 
      });
    }

    // Find the PAD statement in the database by _id
    const padStatement = await PadStatement.findById(id);

    if (!padStatement) {
      return res.status(404).json({ 
        success: false, 
        message: "PAD statement not found" 
      });
    }

    let buffer;
    let contentLength;

    if (padStatement.pdfUrl && padStatement.pdfPublicId) {
      try {
        const downloadResponse = await axios.get(padStatement.pdfUrl, {
          responseType: "arraybuffer",
        });
        buffer = Buffer.from(downloadResponse.data);
        const headerLength = downloadResponse.headers?.["content-length"];
        contentLength = headerLength ? parseInt(headerLength, 10) : buffer.length;
      } catch (downloadErr) {
        if (!padStatement.statement) {
          throw downloadErr;
        }
        const regenerated = await generatePadPDFWithPuppeteer({
          statement: padStatement.statement || '',
          authorizers: padStatement.authorizers,
          contactEmail: padStatement.contactEmail,
          contactPhone: padStatement.contactPhone,
          address: padStatement.address,
          serial: padStatement.serial,
          dateStr: padStatement.dateStr,
        });
        buffer = regenerated.buffer;
        contentLength = buffer.length;
      }
    } else {
      const regenerated = await generatePadPDFWithPuppeteer({
        statement: padStatement.statement || '',
        authorizers: padStatement.authorizers,
        contactEmail: padStatement.contactEmail,
        contactPhone: padStatement.contactPhone,
        address: padStatement.address,
        serial: padStatement.serial,
        dateStr: padStatement.dateStr,
      });
      buffer = regenerated.buffer;
      contentLength = buffer.length;
    }

    // Update download timestamp (add this field to existing records if needed)
    padStatement.downloadedAt = new Date();
    await padStatement.save();

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    const downloadFileName = padStatement.serial ? `${padStatement.serial}.pdf` : `pad-${padStatement._id}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    res.setHeader('Content-Length', contentLength || buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error downloading PAD statement:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const downloadInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "Invoice ID is required" 
      });
    }

    // Find the invoice in the database by _id
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({ 
        success: false, 
        message: "Invoice not found" 
      });
    }

    // Regenerate the PDF using the stored data (use stored issueDate)
    const { buffer } = await generateInvoicePDFWithPuppeteer({
      products: invoice.products,
      authorizerName: invoice.authorizerName,
      authorizerDesignation: invoice.authorizerDesignation,
      contactEmail: invoice.contactEmail,
      contactPhone: invoice.contactPhone,
      address: invoice.address,
      issueDate: invoice.issueDate, // Use the stored issue date
    });

    // Update download timestamp
    invoice.downloadedAt = new Date();
    await invoice.save();

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.serial}.pdf"`);
    res.setHeader('Content-Length', buffer.length);

    // Send the PDF buffer directly
    return res.send(buffer);
  } catch (error) {
    console.error("Error downloading invoice:", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const listInvoiceHistory = async (req, res) => {
  try {
    const invoices = await Invoice.find({})
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ 
      success: true, 
      count: invoices.length, 
      data: invoices 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export { 
  notifyAllUsers, 
  notifyOneUser, 
  sendPadStatementEmail, 
  downloadPadStatementPDF,
  downloadPadStatementById, 
  listPadStatementHistory,
  sendInvoiceEmail,
  downloadInvoicePDF,
  downloadInvoiceById,
  listInvoiceHistory
};

