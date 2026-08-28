const crypto = require('crypto');

const GENESIS_HASH = 'GENESIS';
const ledgerEntries = [];

function readBody(req){
  if(typeof req.body === 'string') return JSON.parse(req.body || '{}');
  return req.body || {};
}

function hashRecord(previousHash, entry, timestamp){
  return crypto
    .createHash('sha256')
    .update(previousHash + JSON.stringify(entry) + timestamp)
    .digest('hex');
}

function appendEntry(rawEntry, timestampOverride){
  const entry = {
    applicationId: String(rawEntry.applicationId || '').trim(),
    stage: String(rawEntry.stage || '').trim(),
    officer: String(rawEntry.officer || '').trim(),
    status: String(rawEntry.status || 'pending').trim(),
    remark: String(rawEntry.remark || '').trim()
  };

  if(!entry.applicationId || !entry.stage){
    throw new Error('applicationId and stage are required');
  }

  const applicationEntries = ledgerEntries.filter(item=>item.applicationId === entry.applicationId);
  const previous = applicationEntries[applicationEntries.length - 1];
  const previousHash = previous ? previous.hash : GENESIS_HASH;
  const timestamp = timestampOverride || new Date().toISOString();
  const hash = hashRecord(previousHash, entry, timestamp);
  const record = {...entry, timestamp, hash, previousHash};
  ledgerEntries.push(record);
  return record;
}

function seedApplication(applicationId, entries){
  if(ledgerEntries.some(item=>item.applicationId === applicationId)) return;
  entries.forEach(item=>appendEntry({applicationId, ...item}, item.timestamp));
}

function seedLedger(){
  seedApplication('NSP-88213', [
    {stage:'Institute Verification', officer:'R. Sinha, Scholarship Cell', status:'flagged', timestamp:'2026-08-14T05:32:00.000Z', remark:"Marked 'income certificate mismatch'. This institute rejects 41% of applications for this exact reason - 3.4x the national average (12%). Flagged for district review."},
    {stage:'District Verification', officer:'District Welfare Office, Bhagalpur', status:'pending', timestamp:'2026-08-14T05:36:00.000Z', remark:"Awaiting institute response. The flagged step must be resolved or overridden before the file can move ahead."},
    {stage:'State Verification', officer:'State Scholarship Cell', status:'pending', timestamp:'2026-08-14T05:39:00.000Z', remark:'Queued after district verification.'},
    {stage:'Fund Disbursal', officer:'Public Finance System', status:'pending', timestamp:'2026-08-14T05:42:00.000Z', remark:'Queued after state approval.'}
  ]);

  seedApplication('NSP-88491', [
    {stage:'Institute Verification', officer:'P. Tiwari, Scholarship Desk', status:'done', timestamp:'2026-08-10T04:20:00.000Z', remark:'Documents checked against mock DigiLocker records and cleared for district review.'},
    {stage:'District Verification', officer:'District Welfare Office, Chitrakoot', status:'flagged', timestamp:'2026-08-12T07:10:00.000Z', remark:"Held for repeated 'document unclear' rejection pattern at the institute. Sent back for a readable certificate review."},
    {stage:'State Verification', officer:'State Scholarship Cell', status:'pending', timestamp:'2026-08-12T07:18:00.000Z', remark:'Waiting for district clarification before state review.'},
    {stage:'Fund Disbursal', officer:'Public Finance System', status:'pending', timestamp:'2026-08-12T07:20:00.000Z', remark:'No payment action until verification clears.'}
  ]);

  seedApplication('NSP-88706', [
    {stage:'Institute Verification', officer:'M. Das, Scholarship Cell', status:'flagged', timestamp:'2026-08-16T06:05:00.000Z', remark:'Manual institute hold has crossed the 15-day guideline. Marked for public delay review.'},
    {stage:'District Verification', officer:'District Welfare Office, Siliguri', status:'pending', timestamp:'2026-08-16T06:11:00.000Z', remark:'Cannot proceed until the institute records a reasoned decision.'},
    {stage:'State Verification', officer:'State Scholarship Cell', status:'pending', timestamp:'2026-08-16T06:15:00.000Z', remark:'Queued after district review.'},
    {stage:'Fund Disbursal', officer:'Public Finance System', status:'pending', timestamp:'2026-08-16T06:18:00.000Z', remark:'Queued after state approval.'}
  ]);
}

seedLedger();

module.exports = async function handler(req, res){
  if(req.method === 'OPTIONS') return res.status(204).end();

  if(req.method === 'GET'){
    const applicationId = String(req.query?.applicationId || '').trim();
    const chain = applicationId
      ? ledgerEntries.filter(item=>item.applicationId === applicationId)
      : ledgerEntries;
    return res.status(200).json({chain});
  }

  if(req.method === 'POST'){
    let payload;
    try{
      payload = readBody(req);
      const record = appendEntry(payload);
      return res.status(201).json({record});
    }catch(err){
      return res.status(400).json({error:err.message || 'Invalid ledger entry'});
    }
  }

  return res.status(405).json({error:'Use GET or POST'});
};
