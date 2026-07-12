/**
 * Data Quality Pipeline — Stage A (Steps 3.1–3.5)
 *
 * Replaces the old blunt cleaner with a multi-stage quality pipeline:
 *  3.1  Gibberish / spam detection (>50% unrecognized tokens → discard)
 *  3.2  Minimum signal threshold (< 5 words → discard)
 *  3.3  Hinglish / non-English handling (keep & tag, don't discard)
 *  3.4  Rating–sentiment mismatch detection (flag contradictions)
 *  3.5  Emoji handling (strip emojis, keep review)
 *
 * Returns enriched review objects with metadata:  { ...review, language, sentimentMismatch }
 */

// ─── 3.1  Lightweight English dictionary for gibberish detection ────────────
// ~1,500 of the most common English words — enough for a >50% token heuristic.
const COMMON_WORDS = new Set([
  'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with',
  'he','as','you','do','at','this','but','his','by','from','they','we','her','she','or',
  'an','will','my','one','all','would','there','their','what','so','up','out','if','about',
  'who','get','which','go','me','when','make','can','like','time','no','just','him','know',
  'take','people','into','year','your','good','some','could','them','see','other','than',
  'then','now','look','only','come','its','over','think','also','back','after','use','two',
  'how','our','work','first','well','way','even','new','want','because','any','these','give',
  'day','most','us','great','very','bad','best','worst','app','order','product','delivery',
  'received','customer','service','money','refund','return','price','quality','items','item',
  'ordered','delivered','never','always','much','too','more','still','every','been','am','are',
  'is','was','were','has','had','did','does','done','been','being','having','doing',
  'said','say','says','got','getting','goes','going','went','come','came','coming',
  'made','making','taken','taking','given','giving','told','telling','asked','asking',
  'used','using','found','finding','called','calling','tried','trying','need','needed',
  'want','wanted','keep','keeping','let','show','showed','showing','pay','paid','paying',
  'buy','bought','buying','sell','selling','sold','send','sent','sending','open','opened',
  'close','closed','start','started','stop','stopped','wait','waited','waiting',
  'help','helped','call','put','run','running','read','feel','left','long','right',
  'big','small','old','high','low','last','next','same','different','own','while',
  'off','before','should','here','where','down','between','own','few','again','really',
  'why','things','thing','many','place','part','those','since','each','both','may',
  'problem','issue','issues','problems','experience','disappointing','disappointed',
  'please','thank','thanks','request','complaint','response','support','contact',
  'cancel','cancelled','cancellation','charge','charged','charges','offer','offers',
  'amount','account','address','available','option','options','shopping','shop','store',
  'online','install','update','updated','review','reviews','rating','star','stars',
  'recommend','recommended','love','loved','hate','amazing','awesome','terrible',
  'horrible','excellent','fantastic','wonderful','awful','poor','nice','fine','okay',
  'happy','satisfied','frustrated','angry','free','fast','slow','easy','hard','simple',
  'wrong','correct','fake','real','fraud','scam','cheat','waste','worth','nothing',
  'everything','something','anything','someone','everyone','nobody','again','already',
  'today','yesterday','tomorrow','week','weeks','month','months','ago','yet','ever',
  'since','until','during','after','before','without','within','through','another',
  'above','below','under','away','around','upon','across','along','behind','against',
  'phone','mobile','number','name','email','sir','madam','dear','hello','hey',
  'please','sorry','parcel','courier','agent','agents','hub','area','pin','code',
  'days','hours','minutes','date','time','times','box','boxes','piece','pieces',
  'pic','photo','image','size','color','colour','design','material','fabric',
  'broken','damaged','missing','incomplete','different','original','copy','duplicate',
  'trust','believe','hope','wish','expect','promise','offer','deal','deals','sale',
  'discount','discounts','coupon','coupons','credit','credits','wallet','payment',
  'payments','cash','cod','upi','bank','card','debit','online','offline','prepaid',
  'postpaid','later','process','processed','pending','status','tracking','track',
  'pick','picked','pickup','deliver','hand','accept','reject','refuse','exchange',
  'replace','replacement','resolve','resolved','resolution','solution','fixed','fix',
  'bug','error','crash','hang','stuck','freeze','verification','verify','verified',
  'block','blocked','ban','banned','access','login','log','sign','otp','message',
  'chat','bot','representative','representative','human','person','team','company',
  'organization','platform','website','site','link','page','screen','button','click',
  'tap','select','choose','add','remove','delete','clear','search','filter','sort',
  'india','indian','rupees','rupee','rs','inr','lakh','crore','village','city','town',
  'state','country','family','friend','friends','brother','sister','mother','father',
  'but','however','although','though','despite','instead','rather','unless','except',
  'whether','either','neither','nor','yet','still','already','just','quite','rather',
  'enough','almost','nearly','ever','never','often','sometimes','usually','rarely',
  'always','maybe','perhaps','probably','certainly','definitely','absolutely','totally',
  'completely','entirely','fully','highly','very','really','quite','pretty','rather',
  'somewhat','slightly','bit','lot','lots','much','more','most','less','least','enough',
  'such','same','different','similar','available','possible','necessary','important',
  'better','worse','cheaper','cheapest','lowest','highest','affordable','reasonable',
  'expensive','costly','budget','value','worth','useful','useless','helpful','unhelpful',
  'proper','improper','fair','unfair','genuine','correct','incorrect','accurate','true',
  'false','safe','safely','secure','securely','smooth','comfortable','convenient',
  'receive','receiving','attempt','attempted','mention','mentioned','information',
  'record','recording','evidence','proof','screenshot','camera','video','unable',
  'inconvenience','unnecessary','frequently','properly','immediately','completely',
  'pathetic','ridiculous','absurd','unacceptable','outrageous','shocking','surprising',
  'impressed','glad','relieved','grateful','thankful','blessed','lucky','fortunate',
]);

/**
 * 3.1 — Gibberish / Spam Detection
 * Returns true if the text appears to be gibberish (>50% unrecognised tokens).
 */
function isGibberish(text) {
  // Tokenize: only keep alpha sequences ≥ 2 chars
  const tokens = text.toLowerCase().match(/[a-z]{2,}/g);
  if (!tokens || tokens.length === 0) {
    // No alpha tokens at all → could be pure Devanagari (handled separately) or pure junk
    // If the text has fewer than 3 non-whitespace chars it's definitely junk
    return text.replace(/\s/g, '').length < 3;
  }
  const recognised = tokens.filter(t => COMMON_WORDS.has(t)).length;
  return recognised / tokens.length < 0.5;
}

/**
 * 3.2 — Minimum Signal Threshold
 * Returns true if the review is too short or carries no product feedback.
 */
function isBelowSignalThreshold(text) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 5) return true;

  // Discard if the text is just the app name or a personal intro with no feedback
  const lower = text.toLowerCase().trim();
  const appOnlyPatterns = [
    /^meesho$/i,
    /^(nice|good|great|best|worst|bad)\s*(app)?$/i,
  ];
  for (const pat of appOnlyPatterns) {
    if (pat.test(lower)) return true;
  }
  return false;
}

/**
 * 3.3 — Language Detection
 * Returns 'devanagari' | 'hinglish' | 'english'
 */
function detectLanguage(text) {
  // Pure Devanagari check
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;
  const totalAlpha = (text.match(/[a-zA-Z\u0900-\u097F]/g) || []).length;

  if (totalAlpha > 0 && devanagariChars / totalAlpha > 0.5) {
    return 'devanagari';
  }

  // Hinglish heuristic: common Hindi words written in Latin script
  const hinglishMarkers = new Set([
    'hai','nahi','aur','ka','ki','ke','ko','se','mein','bhi','kya','toh',
    'hi','karo','hain','yeh','woh','baad','dikha','raha','bahut','bhut',
    'accha','acha','achha','bahot','bohot','sab','hua','hota','hoti','kuch',
    'nahin','lekin','par','abhi','jao','karo','dekho','mil','jata','hy',
    'tera','mera','uska','iska','unka','hamara','apna','sabse','zyada',
    'kam','thoda','bohut','sahi','galat','paisa','diya','liya','gaya',
    'plz','plzz','sir','ji','arre','yaar','bhai','didi',
  ]);
  const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z]/g, '')).filter(Boolean);
  const hinglishCount = words.filter(w => hinglishMarkers.has(w)).length;

  if (words.length > 0 && hinglishCount / words.length >= 0.2 && hinglishCount >= 2) {
    return 'hinglish';
  }
  return 'english';
}

/**
 * 3.4 — Rating–Sentiment Mismatch Detection
 * Returns true if the rating contradicts the dominant sentiment of the text.
 */
function hasSentimentMismatch(text, rating) {
  const lower = text.toLowerCase();

  const negativeSignals = [
    'worst','terrible','horrible','awful','fraud','scam','cheat','fake',
    'disappointed','disappointing','pathetic','useless','waste','don\'t install',
    'never buy','never use','very bad','very poor','not good','unacceptable',
    'disgusting','ridiculous','poor service','bad service','worst app',
    'stupid','rubbish','trash','garbage','hate','angry','frustrated',
  ];
  const positiveSignals = [
    'best','amazing','awesome','excellent','fantastic','wonderful','great',
    'love','loved','satisfied','happy','impressed','perfect','brilliant',
    'superb','outstanding','recommend','reliable','smooth','comfortable',
  ];

  const negHits = negativeSignals.filter(s => lower.includes(s)).length;
  const posHits = positiveSignals.filter(s => lower.includes(s)).length;

  // High rating (4-5) but dominant negative language
  if (rating >= 4 && negHits >= 2 && negHits > posHits) return true;
  // Low rating (1-2) but dominant positive language
  if (rating <= 2 && posHits >= 2 && posHits > negHits) return true;

  return false;
}

/**
 * 3.5 — Strip Emojis from text (keep the review, just clean the text)
 */
function stripEmojis(text) {
  // Remove extended pictographics + variation selectors + ZWJ sequences
  return text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s{2,}/g, ' ').trim();
}


// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Runs the full data quality pipeline on an array of normalised reviews.
 *
 * @param {Array} reviews — Array of { store, rating, title, text, date }
 * @returns {{ cleaned: Array, stats: Object }}
 *   cleaned: enriched reviews with `language` and `sentimentMismatch` fields
 *   stats:   counts of discarded reviews by reason
 */
export function cleanReviews(reviews) {
  if (!Array.isArray(reviews)) return { cleaned: [], stats: {} };

  const stats = {
    total: reviews.length,
    discardedGibberish: 0,
    discardedTooShort: 0,
    discardedPureDevanagari: 0,
    flaggedHinglish: 0,
    flaggedSentimentMismatch: 0,
    emojiStripped: 0,
    kept: 0,
  };

  const cleaned = [];

  for (const review of reviews) {
    let text = review.text || '';

    // Step 3.5 — Strip emojis first (keep review)
    const emojiRegex = /\p{Extended_Pictographic}/u;
    if (emojiRegex.test(text)) {
      text = stripEmojis(text);
      stats.emojiStripped++;
    }

    // Step 3.2 — Minimum signal threshold
    if (isBelowSignalThreshold(text)) {
      stats.discardedTooShort++;
      continue;
    }

    // Step 3.1 — Gibberish / spam
    if (isGibberish(text)) {
      stats.discardedGibberish++;
      continue;
    }

    // Step 3.3 — Language detection
    const language = detectLanguage(text);
    if (language === 'devanagari') {
      // Only discard if pure Devanagari AND too short to carry signal
      const latinWords = text.match(/[a-zA-Z]{2,}/g) || [];
      if (latinWords.length < 3) {
        stats.discardedPureDevanagari++;
        continue;
      }
    }
    if (language === 'hinglish') {
      stats.flaggedHinglish++;
    }

    // Step 3.4 — Rating–sentiment mismatch
    const sentimentMismatch = hasSentimentMismatch(text, review.rating);
    if (sentimentMismatch) {
      stats.flaggedSentimentMismatch++;
    }

    cleaned.push({
      ...review,
      text,            // possibly emoji-stripped
      language,
      sentimentMismatch,
    });
    stats.kept++;
  }

  return { cleaned, stats };
}
