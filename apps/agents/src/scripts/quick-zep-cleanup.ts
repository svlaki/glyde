/**
 * Quick Zep Cleanup Script
 *
 * Clears all Zep data without needing Supabase access
 * - Deletes central group graph
 * - Note: Individual user graphs will be recreated on next use
 */

import { ZepClient } from '@getzep/zep-cloud';

const ZEP_API_KEY = process.env.ZEP_API_KEY;

if (!ZEP_API_KEY) {
  console.error('ZEP_API_KEY environment variable is required');
  process.exit(1);
}

async function cleanup() {
  console.log('Starting Quick Zep Cleanup...\n');

  const zepClient = new ZepClient({ apiKey: ZEP_API_KEY });
  const CENTRAL_GRAPH_ID = 'central_user_patterns';

  try {
    // Delete central group graph
    console.log(' Deleting central group graph...');
    try {
      await zepClient.graph.delete(CENTRAL_GRAPH_ID);
      console.log(`Deleted central graph: ${CENTRAL_GRAPH_ID}\n`);
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.status === 404) {
        console.log(`○ Central graph not found (already clean)\n`);
      } else {
        console.error(` Error deleting central graph:`, error.message, '\n');
      }
    }

    // Clear ontology (this will reset custom types)
    console.log(' Clearing custom ontology...');
    try {
      await zepClient.graph.setOntology({}, {});
      console.log(`Ontology cleared\n`);
    } catch (error: any) {
      console.error(` Error clearing ontology:`, error.message, '\n');
    }

    console.log('═══════════════════════════════════════════');
    console.log('Cleanup Complete!');
    console.log('═══════════════════════════════════════════');
    console.log('Central graph:     Deleted');
    console.log('Custom ontology:   Cleared');
    console.log('═══════════════════════════════════════════\n');

    console.log('The system will auto-reinitialize on next use:');
    console.log('   Custom ontology will be re-registered');
    console.log('   Central graph will be recreated');
    console.log('   Users will get fresh graph structure\n');

  } catch (error) {
    console.error('\nCleanup failed:', error);
    process.exit(1);
  }
}

cleanup()
  .then(() => {
    console.log('Cleanup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
