import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';
import { fetchAllReviews } from './ingestion.js';
import { cleanReviews } from './cleaner.js';
import { generatePulse } from './pulseGenerator.js';
import { publishToGoogleDocs } from './docsPublisher.js';
import { createGmailDraft } from './gmailDrafter.js';
import { initDB, savePulseToDatabase } from './db.js';
import { disconnectAll } from './mcpClients.js';

export async function runWeeklyPulse() {
  const summary = {
    reviewsProcessed: '0 / 0',
    pulseGenerated: false,
    googleDocUrl: null,
    gmailDraftId: null,
    errors: []
  };

  try {
    // ════════════════════════════════════════════════════════════════════════
    // Phase 1: Database Initialization
    // ════════════════════════════════════════════════════════════════════════
    await initDB();

    // ════════════════════════════════════════════════════════════════════════
    // Phase 2: Data Ingestion & Sanitization
    // ════════════════════════════════════════════════════════════════════════
    console.log('═══ Phase 2: Data Ingestion & Sanitization ═══\n');

    const iosAppId = process.env.APP_STORE_APP_ID;
    const androidAppId = process.env.PLAY_STORE_APP_ID;
    const finalIosId = iosAppId || '553834731';
    const finalAndroidId = androidAppId || 'com.king.candycrushsaga';

    const allReviews = await fetchAllReviews(finalIosId, finalAndroidId);
    console.log(`Total reviews collected initially: ${allReviews.length}`);
    
    if (allReviews.length > 0) {
      const rawCachePath = path.resolve(process.cwd(), 'reviews_cache.json');
      await fs.writeFile(rawCachePath, JSON.stringify(allReviews, null, 2), 'utf-8');
    }

    // ════════════════════════════════════════════════════════════════════════
    // Phase 3 — Stage A: Data Quality Pipeline
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ Phase 3, Stage A: Data Quality Pipeline ═══\n');

    const { cleaned: cleanedReviews, stats } = cleanReviews(allReviews);
    summary.reviewsProcessed = `${stats.kept} / ${stats.total}`;

    if (cleanedReviews.length === 0) {
      throw new Error('No reviews survived cleaning. Cannot proceed to LLM analysis.');
    }

    const cachePath = path.resolve(process.cwd(), 'normalize_review.json');
    await fs.writeFile(cachePath, JSON.stringify(cleanedReviews, null, 2), 'utf-8');

    // ════════════════════════════════════════════════════════════════════════
    // Phase 3 — Stages B/C/D: Groq LLM Integration & Pulse Generation
    // ════════════════════════════════════════════════════════════════════════
    if (!process.env.GROQ_API_KEY?.trim()) {
      throw new Error('GROQ_API_KEY not set in .env — skipping LLM analysis.');
    }

    const { pulse, themeData, validation } = await generatePulse(cleanedReviews);
    summary.pulseGenerated = true;
    summary.pulseWordCount = validation.details.wordCount;

    const pulsePath = path.resolve(process.cwd(), 'weekly_pulse.md');
    await fs.writeFile(pulsePath, pulse, 'utf-8');

    // ════════════════════════════════════════════════════════════════════════
    // Phase 5: Google Docs, Gmail & DB Integration
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n═══ Phase 5: Google Docs, Gmail & DB Integration ═══\n');

    console.log('📋 Saving to Database...');
    await savePulseToDatabase(pulse, allReviews.length);

    const docsResult = await publishToGoogleDocs(pulse);
    summary.googleDocUrl = docsResult.docUrl;

    const emailResult = await createGmailDraft(pulse, docsResult.docUrl);
    summary.gmailDraftId = emailResult.draftId;

  } catch (err) {
    console.error('\n❌ Pipeline Error:', err.message);
    summary.errors.push(err.message);
  } finally {
    await disconnectAll();
  }

  // ════════════════════════════════════════════════════════════════════════
  // Pipeline Summary Report
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n═══ Pipeline Summary ═══');
  console.log(`   Reviews processed:  ${summary.reviewsProcessed}`);
  
  if (summary.pulseGenerated) {
    console.log(`   Pulse generated:    ✅ (${summary.pulseWordCount} words, validated)`);
  } else {
    console.log('   Pulse generated:    ❌ Failed or skipped');
  }

  if (summary.googleDocUrl) {
    console.log(`   Google Doc:         ✅ ${summary.googleDocUrl}`);
  } else {
    console.log('   Google Doc:         ⚠️ Skipped or failed (saved locally)');
  }

  if (summary.gmailDraftId) {
    console.log(`   Gmail Draft:        ✅ Draft created (ID: ${summary.gmailDraftId})`);
  } else {
    console.log('   Gmail Draft:        ⚠️ Skipped or failed (saved locally)');
  }

  if (summary.errors.length > 0) {
    console.log('\n   Errors encountered:');
    for (const error of summary.errors) {
      console.log(`     - ${error}`);
    }
  }
  console.log('════════════════════════\n');
}
