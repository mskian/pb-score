import 'dotenv/config';
import axios from 'axios';
import PocketBase from 'pocketbase/cjs';

const {
  POCKETBASE_URL,
  POCKETBASE_EMAIL,
  POCKETBASE_PASSWORD,
  RECORD_ID,
  SCORE_DB,
  MATCH_ID,
  PB_COLLECTION
} = process.env;

if (!POCKETBASE_URL || !POCKETBASE_EMAIL || !POCKETBASE_PASSWORD || !SCORE_DB) {
  console.error('❌ Missing required environment variables. Check your .env file.');
  process.exit(1);
}

const fetchMatchID = async () => {
  try {
    const res = await axios.get(MATCH_ID, { timeout: 3000 });
    if (!res.data?.data_id) throw new Error('Missing `data_id` in match ID source.');
    return res.data.data_id;
  } catch (error) {
    throw new Error(`Failed to fetch match ID: ${error.message}`);
  }
};

const fetchLiveScore = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
      }
    });

    const data = response.data;
    const requiredFields = ['title', 'update'];

    for (const field of requiredFields) {
      if (!data[field] || typeof data[field] !== 'string') {
        throw new Error(`Missing or invalid field: ${field}`);
      }
    }

    return {
      title: data.title.replace(' - Live Cricket Score', '').trim(),
      update: data.update.trim(),
      livescore: (data.livescore || '').trim(),
      runrate: (data.runrate || '').trim()
    };
  } catch (error) {
    throw new Error(`Fetch error: ${error.message}`);
  }
};

const syncToPocketBase = async (record) => {
  const pb = new PocketBase(POCKETBASE_URL);

  try {
    await pb.collection('_superusers').authWithPassword(POCKETBASE_EMAIL, POCKETBASE_PASSWORD);
    const collection = pb.collection(PB_COLLECTION);

    const result = RECORD_ID
      ? await collection.update(RECORD_ID, record)
      : await collection.create(record);

    console.log(`✅ Record ${RECORD_ID ? 'updated' : 'created'}: ${result.id}`);
  } catch (err) {
    throw new Error(`PocketBase sync error: ${err.message}`);
  }
};

const main = async () => {
  try {

    console.log('🔄 Fetching match ID...');
    const matchID = await fetchMatchID();

    console.log(`📌 Match ID: ${matchID}`);
    const fullScoreUrl = `${SCORE_DB}${matchID}`;

    console.log('📡 Fetching live score...');
    const scoreData = await fetchLiveScore(fullScoreUrl);

    console.log('💾 Syncing to PocketBase...');
    await syncToPocketBase(scoreData);

    console.log('✅ Sync complete.');

  } catch (err) {

    console.error(`❌ ${err.message}`);
    process.exit(1);

  }
};

main();
