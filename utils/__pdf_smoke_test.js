import { writeFile } from 'fs/promises';
import { generatePadPDF } from './generatePDF.js';

(async () => {
  const { buffer, serial, dateStr } = await generatePadPDF({
    statement: `This is a test paragraph for pcIST pad statement.

Another paragraph to check wrapping and pagination. `.repeat(10),
    authorizedBy: 'Md. Example',
    authorizerName: 'General Secretary',
    contactEmail: 'pcist@example.com',
    contactPhone: '+8801XXXXXXXXX',
    address: 'Institute of Science & Technology (IST), Dhaka'
  });
  const out = `./_sample_${serial}.pdf`;
  await writeFile(out, buffer);
  console.log('Wrote', out, 'Date:', dateStr, 'Size:', buffer.length);
})();
