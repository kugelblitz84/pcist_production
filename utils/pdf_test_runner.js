#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { generatePadPDFWithPuppeteer } from './generatePDF_puppeteer.js';

const OUT_DIR = path.resolve(process.cwd(), 'tmp');
const OUT_FILE = path.join(OUT_DIR, 'test-pad.pdf');

const sample = {
  statement: `Dear Sir/Madam,\n\nWe are pleased to share updates on upcoming activities of the Programming Club of IST (pcIST). The club will organize workshops on competitive programming, regular problem-solving sessions, and hackathons to foster a culture of innovation and collaboration among students.\n\nWe request your kind cooperation and any necessary permissions to execute these plans smoothly.\n\nSincerely,\nProgramming Club of IST (pcIST)`,
  authorizers: [
    { name: 'Md Sazzad Hossain', role: 'General Secretary' },
    { name: 'Dr. A. K. M. Rahman', role: 'Head of Department' },
    { name: 'test', role: 'test' }
  ],
  contactEmail: 'sadimahmud338@gmail.com',
  contactPhone: '+8801XXXXXXXXX',
  address: 'Institute of Science & Technology (IST), Dhaka'
};

(async function run(){
  try{
    await fs.mkdir(OUT_DIR, { recursive: true });
    const { buffer, serial, dateStr } = await generatePadPDFWithPuppeteer(sample);
    await fs.writeFile(OUT_FILE, buffer);
    console.log('PDF generated:', OUT_FILE);
    console.log('serial:', serial, 'date:', dateStr);
  }catch(err){
    console.error('Failed to generate PDF:', err);
    process.exitCode = 2;
  }
})();
