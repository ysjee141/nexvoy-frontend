import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { execSync } from 'child_process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VERSION = process.env.APP_VERSION || JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const isDryRun = process.argv.includes('--dry-run');

if (!isDryRun && (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required env vars.');
  process.exit(1);
}

const supabase = isDryRun ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deploy() {
  const zipPath = path.join(process.cwd(), `${VERSION}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  console.log(`Starting OTA deployment for version ${VERSION}...${isDryRun ? ' (DRY RUN)' : ''}`);

  // out/ 디렉토리 존재 및 내용 확인
  const outDir = path.join(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    console.error('ERROR: "out/" directory does not exist. Run "pnpm build:mobile" first.');
    process.exit(1);
  }
  const outFiles = fs.readdirSync(outDir);
  if (outFiles.length === 0) {
    console.error('ERROR: "out/" directory is empty. Build may have failed.');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(outDir, 'index.html'))) {
    console.error('ERROR: "out/index.html" not found. Build output is invalid.');
    process.exit(1);
  }
  console.log(`Found ${outFiles.length} entries in out/ directory.`);

  output.on('close', async () => {
    const totalBytes = archive.pointer();
    console.log(`${totalBytes} total bytes`);
    console.log('Archive has been finalized.');

    // ZIP 크기 검증 — 정상 빌드는 최소 수 MB
    if (totalBytes < 10000) {
      console.error(`ERROR: ZIP file is too small (${totalBytes} bytes). The 'out/' directory may be empty or the build failed.`);
      fs.unlinkSync(zipPath);
      process.exit(1);
    }

    if (isDryRun) {
      console.log('Dry run: Skipping upload and database update.');
      fs.unlinkSync(zipPath);
      console.log('Cleanup complete. Dry run finished successfully.');
      return;
    }

    try {
      const channelArg = process.argv.find(arg => arg.startsWith('--channel='));
      const channel = channelArg ? channelArg.split('=')[1] : 'production';

      // 1. Upload to Storage
      const fileBuffer = fs.readFileSync(zipPath);
      const storagePath = `bundles/${channel}/${VERSION}.zip`;
      
      console.log(`Uploading ${storagePath} to Supabase Storage (${channel} channel)...`);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('app-updates')
        .upload(storagePath, fileBuffer, {
          contentType: 'application/zip',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('app-updates')
        .getPublicUrl(storagePath);

      console.log(`File uploaded successfully. Public URL: ${publicUrl}`);

      // 3. Update Database
      console.log(`Updating app_versions table (channel: ${channel})...`);
      const { data: dbData, error: dbError } = await supabase
        .from('app_versions')
        .insert({
          version: VERSION,
          bundle_url: publicUrl,
          is_active: true,
          channel: channel,
          min_native_version: process.env.MIN_NATIVE_VERSION || '1.0.0'
        });

      if (dbError) throw dbError;

      console.log('OTA deployment completed successfully!');
      
      // Cleanup
      fs.unlinkSync(zipPath);
    } catch (err) {
      console.error('Deployment failed:', err);
      process.exit(1);
    }
  });

  archive.on('error', (err) => { throw err; });
  archive.pipe(output);

  // Archive 'out' directory
  console.log('Zipping "out" directory...');
  archive.directory('out/', false);
  await archive.finalize();
}

deploy();
