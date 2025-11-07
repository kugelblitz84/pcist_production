import puppeteer from "puppeteer-core";
//   try {
//     puppeteer = (await import('puppeteer')).default;
//   } catch {
//     throw new Error('Puppeteer is not installed. Run `npm install puppeteer`.');
//   }

let Browser = null;

export const getPuppeteerInstance = async () => {
  if (Browser) {
    return Browser;
  }
  // Check if running on Heroku or other cloud environments
  const isHeroku = process.env.DYNO || process.env.NODE_ENV === 'production';
  
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage', // Overcome limited resource problems
    '--disable-gpu',
    '--disable-features=VizDisplayCompositor',
    '--run-all-compositor-stages-before-draw',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
    '--font-render-hinting=none', // Consistent font rendering
    '--force-color-profile=srgb', // Consistent color rendering
    '--disable-font-subpixel-positioning', // More consistent text rendering
  ];
  
  // Add Heroku-specific optimizations
  if (isHeroku) {
    launchArgs.push(
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--single-process' // Sometimes helps with consistency on Heroku
    );
  }
  
  const execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.GOOGLE_CHROME_BIN ||
    undefined;

  const browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
    executablePath: execPath,
    defaultViewport: null, // Use default viewport
    ignoreDefaultArgs: ['--disable-extensions'], // Allow better rendering
  });


  return browser;
};
