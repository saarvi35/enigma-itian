/* Editable case pack. Every packet uses the same five-step deduction chain. */
const makePacket = (id, session, file, rows, direction, cipher, morse, returned, key) => {
  const trail = { answer: session, file, logs: rows };
  trail.clue = `INCIDENT DESK / 21:06 — An approved transfer leaves a DIGEST in the same session before EXPORT. The mirror may purge a temporary stage file a few seconds later; it never deletes the source.\n\nOPS CHANNEL / 21:12 — A MOUNT by itself proves nothing. One export is routine, one session is incomplete, and one sequence ends with the source disappearing. Compare action, target and session together.`;
  return { id, trail, direction, cipher, morse, issuerBadge: '7', keyReturned: returned, key, sessionStarted: rows.find(row=>row[1]===session)[0] };
};

window.ENIGMA_CASE = {
  durationSeconds: 45 * 60,
  variants: [
    makePacket('A','K2','vault_index_04',[
      ['20:03:10','K2','MOUNT','vault_index_04'],['20:04:26','K2','EXPORT','vault_index_04'],['20:04:29','K2','DELETE','vault_index_04'],
      ['20:11:08','C8','MOUNT','archive_04'],['20:12:12','C8','DIGEST','archive_04'],['20:13:41','C8','EXPORT','archive_04'],['20:13:44','C8','PURGE','stage.tmp'],
      ['20:19:04','M5','MOUNT','vault_index_04'],['20:20:17','M5','EXPORT','vault_index_04']
    ],'NORTH','PQTVJ','-. --- .-. - ....','20:01','2174'),
    makePacket('B','M4','vault_index_06',[
      ['20:08:11','M4','MOUNT','vault_index_06'],['20:09:31','M4','EXPORT','vault_index_06'],['20:09:34','M4','DELETE','vault_index_06'],
      ['20:14:02','C8','MOUNT','archive_06'],['20:15:15','C8','DIGEST','archive_06'],['20:16:42','C8','EXPORT','archive_06'],['20:16:45','C8','PURGE','stage.tmp'],
      ['20:23:09','M5','MOUNT','vault_index_06'],['20:24:21','M5','EXPORT','vault_index_06']
    ],'EAST','IEWX','. .- ... -','20:05','4276'),
    makePacket('C','C3','vault_index_04',[
      ['21:02:11','C8','MOUNT','archive_04'],['21:03:40','C8','DIGEST','archive_04'],['21:05:11','C8','EXPORT','archive_04'],['21:05:14','C8','PURGE','stage.tmp'],
      ['21:17:02','C3','MOUNT','vault_index_04'],['21:18:40','C3','EXPORT','vault_index_04'],['21:18:43','C3','DELETE','vault_index_04'],
      ['21:22:07','M5','MOUNT','vault_index_04'],['21:23:15','M5','EXPORT','vault_index_04']
    ],'WEST','ZHVW','.-- . ... -','21:14','3474'),
    makePacket('D','R5','vault_index_02',[
      ['19:47:06','R5','MOUNT','vault_index_02'],['19:48:25','R5','EXPORT','vault_index_02'],['19:48:28','R5','DELETE','vault_index_02'],
      ['19:54:33','C8','MOUNT','archive_02'],['19:55:41','C8','DIGEST','archive_02'],['19:57:08','C8','EXPORT','archive_02'],['19:57:11','C8','PURGE','stage.tmp'],
      ['20:03:22','M5','MOUNT','vault_index_02'],['20:04:35','M5','EXPORT','vault_index_02']
    ],'SOUTH','XTZYM','... --- ..- - ....','19:44','5372')
  ],
  rounds: [
    { title:'The Digital Trail', eyebrow:'01 / TRACE THE BREACH', intro:'During the night shift, a source file was exported and erased. The audit mirror is incomplete. Reconstruct which session performed the suspicious transfer by comparing the service notes with the event sequence.', question:'Which session tag performed the suspicious export and deletion? Enter the full tag.', hints:[{type:'free',text:'A verified export needs a DIGEST in the same session. A staging purge is different from deleting the source file.'},{type:'penalty',text:'Find the session that has an EXPORT, then a source DELETE three seconds later, with no DIGEST between its MOUNT and EXPORT.'}] },
    { title:'Decode', eyebrow:'02 / READ THE SIGNAL', intro:'The recovered metadata contains two encodings of one destination. The rotation key is carried by the session you just identified. Decode the letter stream and check it against the Morse fragment.', question:'What compass direction do both fragments name?', hints:[{type:'free',text:'Use the final digit of the session tag as a Caesar shift. Move each cipher letter backwards by that many places; Morse is letter-separated.'},{type:'penalty',text:'The direction must agree in both fragments. The route map in the next file assigns each direction a gate number.'}] },
    { title:'The Investigation', eyebrow:'03 / CONNECT THE RECORDS', intro:'The session tag is still anonymous. Match its issuer record to the badge custody sheet, then test the suspects’ statements against their access scope and the incident timeline.', question:'Whose account issued the suspicious session? Enter the surname.', hints:[{type:'free',text:'Match the issuer badge tail in the session audit to the custody roster. Check the return time against the terminal event.'},{type:'penalty',text:'Only one badge was checked back in before its matched terminal session began.'}] },
    { title:'The Locked System', eyebrow:'04 / BUILD THE ACCESS KEY', intro:'The recovery console accepts a four-cell key. Its order is fixed, but each cell is evidence you have already recovered. Assemble the values carefully; the file index is part of the key.', question:'Enter the four-digit recovery key, with no spaces.', hints:[{type:'free',text:'Read the panel cells left to right. Convert the decoded direction using the gate map, then use the badge and file suffixes from the evidence.'},{type:'penalty',text:'The cells are: session suffix · gate number · issuer badge tail · vault file index.'}] },
    { title:'The Last Login', eyebrow:'05 / RESTORE THE FILE', intro:'The archive has been located and the access key accepted. One final recovery string binds the route, the responsible account and the key into a single audit-safe code.', question:'Enter the final recovery code in the format shown.', hints:[{type:'free',text:'Use the direction, the suspect surname, and the four-digit key, in that order.'},{type:'penalty',text:'Format: DIRECTION-SURNAME-KEY. Use hyphens and no spaces.'}] }
  ],
  suspects:[
    {name:'Nisha Rao',role:'Systems lead',badge:'NR–4',status:'AUDIT MIRROR · NORTH LAB',access:'Badge tail 4',statement:'My session ended before the archive window.',initials:'NR'},
    {name:'Manav Sen',role:'Archive assistant',badge:'MS–2',status:'READ ONLY · ARCHIVE DESK',access:'Badge tail 2',statement:'I checked the archive index, then signed out.',initials:'MS'},
    {name:'Aarav Gill',role:'Network analyst',badge:'AG–6',status:'REQUEST DENIED · EAST NODE',access:'Badge tail 6',statement:'The vault rejected my request. I could not export anything.',initials:'AG'},
    {name:'Simran Kapoor',role:'Security coordinator',badge:'SK–7',status:'TEMPORARY EXPORT · TERMINAL KEY',access:'Badge tail 7',statement:'I returned the terminal key before the incident window.',initials:'SK'}
  ],
  issuerAudit:'The terminal bridge links the suspicious session to the issuer badge tail shown here. Compare the key-return record with the session start.',
  routeMap:'NORTH = 1 · EAST = 2 · SOUTH = 3 · WEST = 4',
  lockedInstruction:'KEY CELLS / left to right: suspicious session suffix · route gate number · issuer badge tail · vault file index suffix.',
  finalFormat:'DIRECTION — SURNAME — FOUR-DIGIT RECOVERY KEY'
};
for (const v of window.ENIGMA_CASE.variants) {
  v.decode={answer:v.direction,binary:v.cipher,morse:v.morse};
  v.locked={answer:v.key,cipher:'SESSION · GATE · BADGE · INDEX',clue:window.ENIGMA_CASE.lockedInstruction};
  v.final={answer:`${v.direction}-KAPOOR-${v.key}`,clue:window.ENIGMA_CASE.finalFormat};
}
