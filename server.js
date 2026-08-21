const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

// Load simple KEY=VALUE pairs from .env without requiring an extra package.
// Secrets stay on the backend and are never sent to the browser.
function loadEnvFile(file = path.join(__dirname, ".env")) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (_) {
    // .env is optional; the app can still run in offline/demo mode.
  }
}
loadEnvFile();

const PORT = process.env.PORT || 5001;
const PUBLIC = path.join(__dirname, "public");

const db = {
  account: {
    maskedNumber: "XXXX XXXX 1234",
    balance: 25400,
    availableBalance: 25400,
    accountType: "Savings Account",
    ifsc: "SBIN0000000",
    branch: "SBI Main Branch (Demo)",
    status: "Active",
    nominee: "Registered",
    kyc: "Completed"
  },
  transactions: [
    { date: "14 Aug 2026", type: "Cash Deposit", amount: 5000, mode: "Branch" },
    { date: "12 Aug 2026", type: "UPI Payment", amount: -500, mode: "UPI" },
    { date: "10 Aug 2026", type: "ATM Withdrawal", amount: -2000, mode: "ATM" }
  ],
  branches: [
    { name: "SBI Main Branch (Demo)", address: "Civil Lines, Prayagraj (Demo)", timing: "10:00 AM–4:00 PM" },
    { name: "SBI City Branch (Demo)", address: "Katra, Prayagraj (Demo)", timing: "10:00 AM–4:00 PM" }
  ],
  atm: [
    { name: "SBI ATM (Demo)", address: "Civil Lines, Prayagraj (Demo)" }
  ]
};

const intentPatterns = [
  { intent:"CHECK_BALANCE", keys:["balance","available balance","account balance","how much money","kitna balance","kitna paisa","paisa kitna","बैलेंस","बैलन्स","खाते में कितना","खाते me kitna","कितना पैसा","शेष राशि","शिल्लक","ব্যালেন্স","অ্যাকাউন্টে কত","balance kitna"] },
  { intent:"ACCOUNT_NUMBER", keys:["account number","account no","a/c number","khata number","खाता नंबर","खाता संख्या","account details","खाते का नंबर","अकाउंट नंबर","खाते me number","खाते में नंबर"] },
  { intent:"MINI_STATEMENT", keys:["mini statement","mini-statement","last transaction","recent transaction","recent transactions","transactions","transaction history","statement","लेन-देन","ट्रांजैक्शन","मिनी स्टेटमेंट","स्टेटमेंट","हाल के लेनदेन","শেষ লেনদেন","লেনদেন"] },
  { intent:"BANK_TIMINGS", keys:["bank timing","bank timings","bank hours","when bank open","when bank close","bank open","bank closed","bank kab khulta","bank kab band","bank kab tak","बैंक कब","बैंक कितने बजे","बैंक खुला","बैंक बंद","बैंक टाइमिंग","बैंक का समय","ব্যাংক কখন খোলে","ব্যাংক কখন বন্ধ"] },
  { intent:"NEARBY_BRANCH", keys:["nearby branch","nearest branch","branch near me","nearest bank","bank near me","aas paas bank","पास का बैंक","पास में बैंक","नजदीकी शाखा","नजदीक बैंक","पास वाली शाखा","नज़दीकी बैंक","নিকটবর্তী ব্যাংক"] },
  { intent:"ATM", keys:["atm near","nearest atm","cash machine","atm","एटीएम","एटीएम पास","नजदीकी एटीएम","নিকটবর্তী এটিএম"] },
  { intent:"IFSC", keys:["ifsc","ifsc code","branch code","आईएफएससी","आईएफएससी कोड","ifsc बताओ"] },
  { intent:"ACCOUNT_TYPE", keys:["account type","which account","savings account","current account","खाता प्रकार","सेविंग अकाउंट","बचत खाता","करंट अकाउंट"] },
  { intent:"MAX_BALANCE", keys:["maximum balance","max balance","maximum amount","how much can i keep","how much money can i keep","account me maximum","अधिकतम बैलेंस","ज्यादा से ज्यादा पैसा","अधिकतम राशि","कितना पैसा रख सकता","kitna balance rakh sakta"] },
  { intent:"MINIMUM_BALANCE", keys:["minimum balance","min balance","minimum amount","minimum balance required","न्यूनतम बैलेंस","minimum balance कितना","कम से कम कितना","minimum kitna"] },
  { intent:"UPI_FAILED", keys:["upi failed","upi failure","upi fail","upi payment failed","upi payment nahi hua","upi नहीं हुआ","upi फेल","यूपीआई फेल","यूपीआई काम नहीं","upi transaction failed"] },
  { intent:"UPI_PENDING", keys:["upi pending","payment pending","transaction pending","upi pending hai","payment atka","पेमेंट पेंडिंग","लेनदेन लंबित","upi लंबित"] },
  { intent:"UPI_NOT_RECEIVED", keys:["money not received","payment not received","upi money not received","paisa nahi mila","पैसा नहीं मिला","payment नहीं मिला","upi पैसा नहीं आया","पैसा कट गया लेकिन सामने वाले को नहीं मिला","account से पैसा कट गया","सामने वाले को पैसा नहीं मिला","money deducted but not received","debited but recipient not received"] },
  { intent:"ATM_CASH_NOT_RECEIVED", keys:["cash not received","atm cash not received","cash not dispensed","atm se paisa nahi nikla","atm cash नहीं मिला","एटीएम से पैसा नहीं निकला","atm ने cash नहीं दिया","एटीएम ने पैसा नहीं दिया","atm से पैसा नहीं मिला लेकिन account से कट गया","cash नहीं मिला account debit"] },
  { intent:"CARD_BLOCK", keys:["block my card","card block","debit card block","card blocked","card kho gaya","card lost","card chori","debit card lost","कार्ड ब्लॉक","कार्ड खो गया","एटीएम कार्ड खो गया","डेबिट कार्ड ब्लॉक","मेरा card खो गया","मेरा debit card खो गया","card चोरी हो गया","card गुम हो गया"] },
  { intent:"PIN", keys:["forgot pin","pin forgot","pin reset","change pin","atm pin","pin भूल","पिन भूल गया","पिन बदलना","एटीएम पिन","pin reset"] },
  { intent:"KYC", keys:["kyc","kyc status","kyc update","know your customer","केवाईसी","kyc अपडेट","केवाईसी स्टेटस"] },
  { intent:"NOMINEE", keys:["nominee","nomination","नॉमिनी","नामिनी","nominee add","nominee change"] },
  { intent:"CHEQUE", keys:["cheque","check book","chequebook","cheque book","चेक","चेकबुक","चेक बुक"] },
  { intent:"CASH_DEPOSIT", keys:["cash deposit","deposit cash","cash जमा","नकद जमा","पैसा जमा","cash deposit kaise"] },
  { intent:"CASH_WITHDRAWAL", keys:["cash withdrawal","withdraw cash","paisa nikalo","cash निकालना","नकद निकाल","cash withdrawal kaise"] },
  { intent:"CARD_LIMIT", keys:["card limit","debit card limit","atm limit","cash withdrawal limit","card transaction limit","कार्ड लिमिट","एटीएम लिमिट","निकासी सीमा"] },
  { intent:"TRANSFER_LIMIT", keys:["transfer limit","upi limit","fund transfer limit","daily transfer","ट्रांसफर लिमिट","यूपीआई लिमिट","एक दिन में कितना ट्रांसफर"] },
  { intent:"CHARGES", keys:["charges","bank charges","fees","fee","atm charges","sms charges","service charge","शुल्क","चार्ज","बैंक चार्ज","फीस","एटीएम चार्ज"] },
  { intent:"INTEREST", keys:["interest rate","savings interest","interest on savings","ब्याज","ब्याज दर","savings interest rate","fd interest"] },
  { intent:"FD", keys:["fixed deposit","fd","term deposit","फिक्स्ड डिपॉजिट","एफडी","मुदत ठेव","ফিক্সড ডিপোজিট"] },
  { intent:"LOAN", keys:["loan","home loan","personal loan","education loan","car loan","लोन","ऋण","होम लोन","पर्सनल लोन"] },
  { intent:"LOAN_EMI", keys:["emi","loan emi","emi date","emi amount","ईएमआई","emi कब","loan payment"] },
  { intent:"MOBILE_BANKING", keys:["mobile banking","mobile app","sbi app","online banking","net banking","योनो","मोबाइल बैंकिंग","नेट बैंकिंग","online banking"] },
  { intent:"PASSWORD", keys:["forgot password","password reset","net banking password","login password","पासवर्ड भूल","पासवर्ड बदल","password reset"] },
  { intent:"FRAUD", keys:["fraud","scam","scammed","unauthorized transaction","unknown transaction","fraud transaction","धोखा","फ्रॉड","अनजान ट्रांजैक्शन","अनधिकृत लेनदेन","scam"] },
  { intent:"COMPLAINT", keys:["complaint","complain","grievance","customer care","complaint register","शिकायत","शिकायत दर्ज","कस्टमर केयर"] },
  { intent:"ACCOUNT_STATUS", keys:["account status","account active","account dormant","dormant account","खाता सक्रिय","खाता बंद","डॉर्मेंट अकाउंट"] },
  { intent:"BANK_DETAILS", keys:["bank details","about sbi","sbi kya hai","bank head","chairman","who is chairman","एसबीआई क्या है","बैंक के बारे में"] },
  { intent:"SATURDAY_BANK", keys:["saturday bank","saturday branch","saturday open","saturday closed","saturday working","शनिवार बैंक","शनिवार को बैंक","शनिवार बैंक खुला","शनिवार बंद","शनिवार को शाखा","शनिवार काम","2nd saturday","2nd शनिवार","दूसरा शनिवार","4th saturday","4th शनिवार","चौथा शनिवार","first saturday","पहला शनिवार","third saturday","तीसरा शनिवार","fifth saturday","पांचवा शनिवार"] },
  { intent:"SUNDAY_BANK", keys:["sunday bank","sunday branch","sunday open","sunday closed","रविवार बैंक","रविवार को बैंक","रविवार बंद","रविवार शाखा"] },
  { intent:"TODAY_BANK", keys:["is bank open today","bank open today","today bank","aaj bank khula","aaj bank band","आज बैंक खुला","आज बैंक बंद","आज शाखा खुली","आज बैंक की छुट्टी"] },
  { intent:"HOLIDAY_BANK", keys:["bank holiday","bank holidays","holiday list","bank holiday list","बैंक की छुट्टी","बैंक छुट्टी","बैंक हॉलिडे","छुट्टियों की सूची","holiday कब"] },
  { intent:"BRANCH_LUNCH", keys:["bank lunch time","branch lunch","lunch time bank","bank me lunch","bank lunch break","बैंक में लंच","लंच टाइम","बैंक का लंच टाइम","branch lunch break"] },
  { intent:"ACCOUNT_OPENING", keys:["open account","new account","account opening","open savings account","नया खाता","खाता खोलना","खाता खोलना है","savings account खोलना","नया सेविंग अकाउंट"] },
  { intent:"JOINT_ACCOUNT", keys:["joint account","joint savings","संयुक्त खाता","जॉइंट अकाउंट","दो लोगों का खाता"] },
  { intent:"ADDRESS_UPDATE", keys:["change address","update address","address change","पता बदलना","पता अपडेट","address update"] },
  { intent:"MOBILE_UPDATE", keys:["change mobile number","update mobile number","mobile number change","मोबाइल नंबर बदलना","मोबाइल नंबर अपडेट","mobile number update"] },
  { intent:"EMAIL_UPDATE", keys:["change email","update email","email id change","ईमेल बदलना","ईमेल अपडेट"] },
  { intent:"PAN_UPDATE", keys:["pan update","update pan","pan link","पैन अपडेट","पैन लिंक"] },
  { intent:"AADHAAR_LINK", keys:["aadhaar link","link aadhaar","aadhaar se link","आधार लिंक","आधार से लिंक","आधार जोड़ना"] },
  { intent:"PASSBOOK", keys:["passbook","pass book","पासबुक","पास बुक"] },
  { intent:"FULL_STATEMENT", keys:["account statement","full statement","download statement","statement download","खाते का स्टेटमेंट","पूरा स्टेटमेंट","स्टेटमेंट डाउनलोड"] },
  { intent:"CHEQUE_STOP", keys:["stop cheque","stop payment cheque","cheque stop payment","चेक रोकना","चेक पेमेंट रोकना","stop cheque payment"] },
  { intent:"CHEQUE_BOUNCE", keys:["cheque bounce","check bounce","cheque dishonour","चेक बाउंस","चेक डिसऑनर"] },
  { intent:"NEFT", keys:["neft","neft transfer","नेफ्ट","neft transfer kaise"] },
  { intent:"RTGS", keys:["rtgs","rtgs transfer","आरटीजीएस","rtgs transfer kaise"] },
  { intent:"IMPS", keys:["imps","imps transfer","आईएमपीएस","imps transfer kaise"] },
  { intent:"UPI_PIN", keys:["upi pin","forgot upi pin","change upi pin","upi pin reset","यूपीआई पिन","upi pin भूल गया","upi pin बदलना"] },
  { intent:"UPI_COLLECT", keys:["upi collect request","collect request","upi request","collect payment","upi collect","यूपीआई कलेक्ट","payment request"] },
  { intent:"UPI_AUTOPAY", keys:["upi autopay","autopay","mandate","upi mandate","यूपीआई ऑटोपे","ऑटोपे","mandate cancel"] },
  { intent:"BILL_PAYMENT", keys:["bill payment","pay bill","electricity bill","water bill","recharge","बिल भुगतान","बिजली बिल","पानी का बिल","रिचार्ज"] },
  { intent:"CASH_DEPOSIT_MACHINE", keys:["cash deposit machine","cdm","cash deposit atm","cash deposit machine near","कैश डिपॉजिट मशीन","सीडीएम"] },
  { intent:"CARD_DELIVERY", keys:["card delivery","debit card delivery","card not received","card नहीं मिला","कार्ड कब आएगा","debit card delivery"] },
  { intent:"CARD_EXPIRY", keys:["card expiry","expired card","card expire","कार्ड एक्सपायर","कार्ड की expiry"] },
  { intent:"CARD_ACTIVATION", keys:["activate card","card activation","debit card activate","कार्ड एक्टिवेट","डेबिट कार्ड एक्टिवेट"] },
  { intent:"CARD_UNBLOCK", keys:["unblock card","unblock debit card","card unblock","कार्ड अनब्लॉक","डेबिट कार्ड अनब्लॉक"] },
  { intent:"CONTACTLESS", keys:["contactless card","tap to pay","contactless payment","टैप टू पे","कॉन्टैक्टलेस कार्ड"] },
  { intent:"INTERNATIONAL_CARD", keys:["international transaction","international card","international usage","विदेश में कार्ड","international payment"] },
  { intent:"ACCOUNT_CLOSURE", keys:["close account","account closure","close savings account","खाता बंद करना","अकाउंट बंद करना"] },
  { intent:"BRANCH_TRANSFER", keys:["transfer branch","change home branch","branch change","home branch change","होम ब्रांच बदलना","शाखा बदलना"] },
  { intent:"DORMANT", keys:["dormant account","inactive account","inoperative account","डॉर्मेंट अकाउंट","निष्क्रिय खाता","inoperative account"] },
  { intent:"TDS", keys:["tds","tds certificate","tax deducted","टीडीएस","टीडीएस सर्टिफिकेट"] },
  { intent:"INTEREST_CERTIFICATE", keys:["interest certificate","interest certificate download","ब्याज प्रमाण पत्र","interest certificate चाहिए"] },
  { intent:"ATM_CARD_LIMIT", keys:["daily atm limit","daily cash limit","atm daily limit","एक दिन में atm से कितना","atm daily limit कितना"] },
  { intent:"BANK_TRANSFER_SAFETY", keys:["safe transfer","transfer safe","how to safely transfer","transfer safety","सुरक्षित ट्रांसफर","पैसे भेजते समय सावधानी"] },
  { intent:"PHISHING", keys:["phishing","fake link","fake sms","fake call","otp scam","फर्जी लिंक","फर्जी sms","फर्जी कॉल","ओटीपी फ्रॉड"] },
  { intent:"ATM_RETENTION", keys:["atm card retained","atm swallowed","card stuck in atm","atm card swallowed","एटीएम ने कार्ड रख लिया","एटीएम में कार्ड फंस गया","atm ने card रख लिया"] },
  { intent:"ATM_RECEIPT", keys:["atm receipt","cash withdrawal receipt","एटीएम रसीद","atm receipt नहीं"] },
  { intent:"SERVICE_REQUEST", keys:["service request","bank service request","request status","सर्विस रिक्वेस्ट","service request status"] },
  { intent:"HELP", keys:["help","what can you do","what can i ask","options","menu","मदद","क्या पूछ सकता","आप क्या कर सकते","help me","সাহায্য"] }
];

const replies = {
  hi: {
    CHECK_BALANCE:`आपके डेमो सेविंग्स खाते में उपलब्ध बैलेंस पच्चीस हजार चार सौ रुपये है। यह केवल प्रोटोटाइप का mock data है।`,
    ACCOUNT_NUMBER:`आपके डेमो खाते के आखिरी चार अंक 1234 हैं। सुरक्षा के लिए पूरा account number voice पर नहीं बताया जाता।`,
    MINI_STATEMENT:`हाल के तीन लेन-देन: 14 अगस्त को पांच हजार रुपये cash deposit, 12 अगस्त को पांच सौ रुपये UPI payment, और 10 अगस्त को दो हजार रुपये ATM withdrawal।`,
    BANK_TIMINGS:`डेमो के लिए शाखा समय सुबह 10 बजे से शाम 4 बजे तक रखा गया है। छुट्टी के दिन समय अलग हो सकता है।`,
    NEARBY_BRANCH:`डेमो में नजदीकी SBI शाखा Civil Lines, Prayagraj दिखाई गई है। वास्तविक दूरी के लिए location permission और live branch service जोड़नी होगी।`,
    ATM:`डेमो में SBI ATM Civil Lines, Prayagraj दिखाया गया है। वास्तविक ATM खोजने के लिए location permission जरूरी होगी।`,
    IFSC:`यह प्रोटोटाइप demo IFSC SBIN0000000 इस्तेमाल करता है। असली transfer के लिए अपनी शाखा का official IFSC ही इस्तेमाल करें।`,
    ACCOUNT_TYPE:`यह डेमो Savings Account के लिए बनाया गया है।`,
    MAX_BALANCE:`हर SBI account के लिए एक universal maximum balance नहीं होता। यह account type और उसके नियमों पर निर्भर करता है। इसलिए केवल voice assistant के बताए किसी एक fixed amount पर भरोसा न करें।`,
    MINIMUM_BALANCE:`Minimum balance account type पर निर्भर करता है। कई savings products में अलग नियम हो सकते हैं; अपने account variant की official terms देखें।`,
    UPI_FAILED:`अगर UPI payment failed है, पहले transaction status और account debit check करें। पैसा कट गया हो तो transaction ID सुरक्षित रखें और bank/UPI app में complaint दर्ज करें।`,
    UPI_PENDING:`UPI payment pending होने पर तुरंत दोबारा payment न करें। पहले transaction status देखें और कुछ समय बाद beneficiary/account status verify करें।`,
    UPI_INFO:`UPI एक digital payment system है जिससे bank account से payment किया जा सकता है। किसी payment से पहले receiver और amount verify करें।`,
    OTP_SAFETY:`OTP केवल आपके लिए होता है। इसे किसी caller, message link, assistant या दूसरे व्यक्ति के साथ share न करें।`,
    UPI_NOT_RECEIVED:`अगर आपके खाते से पैसा कट गया लेकिन सामने वाले को नहीं मिला, transaction ID रखें और UPI app में dispute/complaint विकल्प इस्तेमाल करें।`,
    ATM_CASH_NOT_RECEIVED:`ATM ने cash नहीं दिया लेकिन account debit हो गया है तो transaction receipt/ID रखें और bank/ATM dispute दर्ज करें।`,
    CARD_BLOCK:`अगर debit card खो गया है या चोरी हो गया है, सुरक्षा के लिए उसे तुरंत block/hotlist करें और official bank channel से replacement मांगें।`,
    PIN:`PIN भूलने पर official ATM/mobile/internet banking process से PIN reset करें। PIN किसी व्यक्ति या assistant को न बताएं।`,
    KYC:`KYC status और update के लिए official bank channel या branch का उपयोग करें। OTP, PIN या पूरा ID number voice assistant को न दें।`,
    NOMINEE:`Nominee add या change करने के लिए bank के official process/branch का उपयोग करें।`,
    CHEQUE:`Cheque book के लिए official banking channel से request कर सकते हैं। Cheque पर OTP, PIN या sensitive login details न लिखें।`,
    CASH_DEPOSIT:`Cash deposit के लिए branch cash counter या supported cash-deposit machine का उपयोग करें और receipt जरूर रखें।`,
    CASH_WITHDRAWAL:`Cash withdrawal ATM या branch से किया जा सकता है। PIN किसी को न बताएं और transaction receipt संभालकर रखें।`,
    CARD_LIMIT:`Debit card और ATM limits account/card variant पर निर्भर करती हैं। अपने card की official limit check करें; prototype कोई universal limit नहीं मानता।`,
    TRANSFER_LIMIT:`UPI/fund-transfer limit bank, account और payment method के अनुसार बदल सकती है। Transfer से पहले app में current limit देखें।`,
    CHARGES:`Bank charges service और account type पर निर्भर करते हैं। किसी भी charge की current official schedule को verify करें।`,
    INTEREST:`Savings/FD interest rate product और समय के साथ बदल सकती है। Current rate के लिए official bank rate page या branch verify करें।`,
    FD:`Fixed Deposit में एक तय अवधि के लिए पैसा जमा किया जाता है और interest मिलता है। Rate और premature-withdrawal rules product के अनुसार बदलते हैं।`,
    LOAN:`Home, personal, education और अन्य loans की eligibility, interest और fees अलग होती हैं। Loan लेने से पहले EMI, total interest और charges compare करें।`,
    LOAN_EMI:`EMI amount और due date आपके loan account पर निर्भर हैं। Demo assistant exact EMI नहीं बनाता; official loan statement/app से verify करें।`,
    MOBILE_BANKING:`Mobile/net banking के लिए official bank app या website का ही उपयोग करें। Unknown links पर login details न डालें।`,
    PASSWORD:`Password भूलने पर official reset flow इस्तेमाल करें। Password, OTP, PIN या CVV किसी के साथ share न करें।`,
    FRAUD:`अगर unauthorized transaction दिखे तो तुरंत card/account channel सुरक्षित करें, official bank support को report करें और transaction details सुरक्षित रखें। OTP/PIN किसी को न बताएं।`,
    COMPLAINT:`Complaint के लिए official bank grievance/customer-care channel या branch का उपयोग करें। Complaint/reference number संभालकर रखें।`,
    ACCOUNT_STATUS:`डेमो account status Active है। असली account status के लिए official banking channel से verify करें।`,
    BANK_DETAILS:`यह prototype State Bank of India के voice-banking use cases का demo है। इसमें account, payments, card, KYC, branch और safety questions शामिल किए गए हैं।`,
    SATURDAY_BANK:`SBI की सामान्य branch schedule के अनुसार दूसरा और चौथा शनिवार बैंक अवकाश रहता है। पहला, तीसरा और पांचवां शनिवार सामान्यतः working day होते हैं। फिर भी local/state holiday या किसी specific branch का schedule अलग हो सकता है, इसलिए जाने से पहले official branch details verify करें।`,
    SUNDAY_BANK:`रविवार को सामान्य बैंक शाखाएं बंद रहती हैं। ATM और digital banking services उपलब्ध रह सकती हैं।`,
    TODAY_BANK:`आज की branch opening local holiday और branch schedule पर निर्भर करती है। इस demo में मंगलवार को branch working day माना गया है। किसी खास तारीख की छुट्टी के लिए official branch/holiday calendar verify करें।`,
    HOLIDAY_BANK:`Bank holidays राज्य और तारीख के अनुसार अलग हो सकते हैं। दूसरे और चौथे शनिवार तथा रविवार सामान्य weekly holidays हैं; local/state holidays अलग से हो सकते हैं।`,
    BRANCH_LUNCH:`हर branch में अलग lunch arrangement हो सकता है। आम तौर पर banking counters पूरी तरह बंद करके एक universal lunch break नहीं मानना चाहिए; अपनी branch का schedule verify करें।`,
    ACCOUNT_OPENING:`Savings account खोलने के लिए सामान्यतः identity/KYC documents और account-opening form की जरूरत होती है। Exact documents और eligibility account type पर निर्भर करते हैं।`,
    JOINT_ACCOUNT:`Joint account दो या अधिक लोगों के नाम पर खोला जा सकता है। Operation mode जैसे Either or Survivor account opening के समय चुना जाता है।`,
    ADDRESS_UPDATE:`Address update के लिए official bank channel या branch में valid address proof के साथ request करें।`,
    MOBILE_UPDATE:`Registered mobile number बदलने के लिए official bank process/branch का उपयोग करें। OTP या PIN किसी को न बताएं।`,
    EMAIL_UPDATE:`Registered email update करने के लिए official banking channel या branch का उपयोग करें।`,
    PAN_UPDATE:`PAN details update/link करने के लिए official bank channel का उपयोग करें और PAN details केवल trusted banking channel में दें।`,
    AADHAAR_LINK:`Aadhaar linking/update के लिए official bank channel का उपयोग करें। Aadhaar number या OTP voice assistant को न बताएं।`,
    PASSBOOK:`Passbook update/print के लिए branch या available passbook kiosk का उपयोग किया जा सकता है।`,
    FULL_STATEMENT:`Account statement official mobile/internet banking या branch से प्राप्त किया जा सकता है।`,
    CHEQUE_STOP:`Cheque payment रोकने के लिए cheque number और account details के साथ official stop-payment service का उपयोग करें।`,
    CHEQUE_BOUNCE:`Cheque bounce होने पर bank charges और applicable process हो सकता है। Return memo संभालकर रखें और जरूरत होने पर branch से reason पूछें।`,
    NEFT:`NEFT एक bank-to-bank electronic transfer service है। Transfer करते समय beneficiary account number और IFSC ध्यान से verify करें।`,
    RTGS:`RTGS बड़े-value bank transfers के लिए इस्तेमाल होने वाली electronic transfer service है। Beneficiary details verify करके ही transfer करें।`,
    IMPS:`IMPS instant electronic fund transfer service है। Transfer से पहले beneficiary details और amount दोबारा check करें।`,
    UPI_PIN:`UPI PIN केवल UPI app में खुद enter करें। इसे assistant, caller या किसी व्यक्ति को कभी न बताएं। भूलने पर official UPI reset flow इस्तेमाल करें।`,
    UPI_COLLECT:`UPI collect request स्वीकार करने से पहले payer/merchant का नाम और amount verify करें। Unknown request को approve न करें।`,
    UPI_AUTOPAY:`UPI AutoPay mandate recurring payments के लिए होता है। Mandate create या cancel करने से पहले merchant और amount verify करें।`,
    BILL_PAYMENT:`Electricity, water, mobile recharge और अन्य bills official banking/UPI app से pay किए जा सकते हैं। Unknown payment links से बचें।`,
    CASH_DEPOSIT_MACHINE:`Cash Deposit Machine में cash जमा करते समय amount और account details verify करें और receipt जरूर लें।`,
    CARD_DELIVERY:`Debit card delivery status के लिए official bank channel में registered request/status check करें।`,
    CARD_EXPIRY:`Card expire होने वाला हो तो official bank process से replacement/renewal की जानकारी लें।`,
    CARD_ACTIVATION:`New debit card activation के लिए official ATM/mobile banking process का उपयोग करें। PIN किसी को न बताएं।`,
    CARD_UNBLOCK:`अगर card temporarily blocked है तो official bank channel से unblock process शुरू करें। अगर card lost/stolen है तो उसे unblock न करें; पहले security verify करें।`,
    CONTACTLESS:`Contactless card में tap-to-pay सुविधा होती है। Unknown terminal या suspicious transaction पर card use न करें।`,
    INTERNATIONAL_CARD:`International card usage आपके card settings और eligibility पर निर्भर करता है। Foreign transaction शुरू करने से पहले official channel में settings और charges verify करें।`,
    ACCOUNT_CLOSURE:`Account close करने से पहले balance, pending payments, linked mandates और automatic debits check करें। Closure official branch/process से करें।`,
    BRANCH_TRANSFER:`Home branch बदलने के लिए official branch/mobile banking process उपलब्ध होने पर उसका उपयोग करें।`,
    DORMANT:`लंबे समय तक customer-initiated transactions न होने पर account inactive/dormant हो सकता है। Reactivation के लिए official bank process और KYC verification की जरूरत हो सकती है।`,
    TDS:`TDS details और certificate official internet banking/branch से check करें। Tax advice के लिए qualified tax professional से verify करें।`,
    INTEREST_CERTIFICATE:`Interest certificate official banking channel से उपलब्ध हो सकता है। Exact availability account/product पर निर्भर है।`,
    ATM_CARD_LIMIT:`ATM daily cash withdrawal limit card variant और account rules पर निर्भर करती है। अपने official card/app में current limit check करें।`,
    BANK_TRANSFER_SAFETY:`Transfer करने से पहले beneficiary name, account number, IFSC और amount verify करें। OTP, PIN और CVV किसी को न बताएं।`,
    PHISHING:`अगर कोई fake call, SMS या link OTP/PIN/password मांगता है तो उसे ignore करें। Official bank website/app खुद खोलें और suspicious transaction हो तो तुरंत report करें।`,
    ATM_RETENTION:`अगर ATM ने आपका card रख लिया है तो card को immediately secure/block करने के लिए official bank channel से contact करें और ATM location/ID note करें।`,
    ATM_RECEIPT:`ATM receipt न मिले तो transaction SMS/app statement से transaction details देखें और जरूरत होने पर official bank complaint करें।`,
    SERVICE_REQUEST:`Service request status जानने के लिए official bank channel में request/reference number से check करें।`,
    HELP:`आप balance, account number, mini statement, branch/ATM, IFSC, bank timings, minimum/maximum balance, UPI failed/pending, card lost, PIN, KYC, nominee, cheque, cash deposit/withdrawal, limits, charges, interest, FD, loan, EMI, mobile banking, password, fraud और complaint जैसे सवाल पूछ सकते हैं।`,
    UNKNOWN_INTENT:`मुझे यह सवाल पूरी तरह समझ नहीं आया। आप अपना सवाल सामान्य भाषा में दोबारा पूछें, जैसे “मेरा balance कितना है?”, “UPI payment pending है”, “मेरा card खो गया”, या “नजदीकी ATM कहाँ है?”`
  },
  en: {
    CHECK_BALANCE:`Your demo savings account available balance is ₹12,500. This is mock data for the prototype.`,
    ACCOUNT_NUMBER:`The last four digits of your demo account are 1234. For security, the full account number is not spoken.`,
    MINI_STATEMENT:`Recent transactions: 14 Aug ₹5,000 cash deposit, 12 Aug ₹500 UPI payment, and 10 Aug ₹2,000 ATM withdrawal.`,
    BANK_TIMINGS:`For this demo, branch hours are 10 AM to 4 PM. Holiday timings may differ.`,
    NEARBY_BRANCH:`The demo shows an SBI branch in Civil Lines, Prayagraj. Real distance requires location permission and a live branch service.`,
    ATM:`The demo shows an SBI ATM in Civil Lines, Prayagraj. A real ATM finder needs location permission.`,
    IFSC:`The prototype uses demo IFSC SBIN0000000. For a real transfer, always use the official IFSC of your branch.`,
    ACCOUNT_TYPE:`This prototype uses a demo Savings Account.`,
    MAX_BALANCE:`There is no single universal maximum balance for every SBI account. It depends on the account type and its terms. Do not rely on a fixed amount from a voice assistant.`,
    MINIMUM_BALANCE:`Minimum-balance rules depend on the account variant. Check the official terms for your specific savings product.`,
    UPI_FAILED:`If a UPI payment failed, first check the transaction status and whether your account was debited. Keep the transaction ID and raise a complaint through the official UPI/bank channel if needed.`,
    UPI_PENDING:`If a UPI payment is pending, avoid paying again immediately. Check the transaction status and verify the beneficiary after the status is clear.`,
    UPI_NOT_RECEIVED:`If your account was debited but the recipient did not receive the money, keep the transaction ID and use the dispute/complaint option in the official UPI app.`,
    ATM_CASH_NOT_RECEIVED:`If an ATM did not dispense cash but your account was debited, keep the transaction ID/receipt and raise an ATM dispute with the bank.`,
    CARD_BLOCK:`If your debit card is lost or stolen, block/hotlist it immediately through an official bank channel and request a replacement.`,
    PIN:`If you forgot your PIN, use the official ATM/mobile/internet-banking reset process. Never share your PIN with anyone.`,
    KYC:`Use an official bank channel or branch to check or update KYC. Never provide OTPs, PINs, or full identity numbers to a voice assistant.`,
    NOMINEE:`Use the bank's official process or branch to add or change a nominee.`,
    CHEQUE:`You can request a cheque book through an official banking channel. Never write OTPs, PINs, or login details on a cheque.`,
    CASH_DEPOSIT:`For a cash deposit, use a supported branch counter or cash-deposit machine and keep the receipt.`,
    CASH_WITHDRAWAL:`You can withdraw cash at an ATM or branch. Never share your PIN and keep the transaction receipt.`,
    CARD_LIMIT:`Debit-card and ATM limits depend on the card/account variant. Check your official card limit; the prototype does not assume one universal limit.`,
    TRANSFER_LIMIT:`UPI and fund-transfer limits can vary by bank, account, and payment method. Check the current limit in your official app before transferring.`,
    CHARGES:`Bank charges depend on the service and account type. Verify the current official schedule before relying on a fee amount.`,
    INTEREST:`Savings and FD interest rates depend on the product and can change. Verify the current official rate before making a decision.`,
    FD:`A Fixed Deposit keeps money for a chosen tenure and pays interest. Rates and premature-withdrawal rules vary by product.`,
    LOAN:`Home, personal, education and other loans have different eligibility, interest and fees. Compare EMI, total interest and charges before borrowing.`,
    LOAN_EMI:`Your EMI and due date depend on your loan account. This demo does not invent an exact EMI; verify it in the official loan statement/app.`,
    MOBILE_BANKING:`Use only the official bank app or website for mobile/net banking. Do not enter login details on unknown links.`,
    PASSWORD:`Use the official password-reset flow if you forgot your password. Never share your password, OTP, PIN, or CVV.`,
    FRAUD:`For an unauthorized transaction, secure the affected card/account immediately, report it through an official bank channel, and keep the transaction details. Never share OTP or PIN.`,
    COMPLAINT:`Use the official bank grievance/customer-care channel or branch to register a complaint. Keep the complaint/reference number.`,
    ACCOUNT_STATUS:`The demo account status is Active. Verify your real account status through an official banking channel.`,
    BANK_DETAILS:`This prototype demonstrates SBI voice-banking use cases across accounts, payments, cards, KYC, branches and customer safety.`,
    HELP:`You can ask about balance, account number, mini statement, branches/ATMs, IFSC, bank timings, minimum/maximum balance, UPI failed/pending, lost card, PIN, KYC, nominee, cheque, cash deposit/withdrawal, limits, charges, interest, FD, loans, EMI, mobile banking, password, fraud and complaints.`,
    UNKNOWN_INTENT:`I could not fully understand that. Try asking in simple words, such as “what is my balance?”, “my UPI payment is pending”, “my card is lost”, or “where is the nearest ATM?”`
  },
  mr: {
    CHECK_BALANCE:"तुमच्या डेमो सेव्हिंग्स खात्यातील उपलब्ध शिल्लक ₹12,500 आहे. हे फक्त प्रोटोटाइपचे mock data आहे.",
    ACCOUNT_NUMBER:"तुमच्या डेमो खात्याचे शेवटचे चार अंक 1234 आहेत. सुरक्षिततेसाठी पूर्ण खाते क्रमांक सांगितला जात नाही.",
    MINI_STATEMENT:"अलीकडील व्यवहार: 14 ऑगस्ट ₹5,000 cash deposit, 12 ऑगस्ट ₹500 UPI payment आणि 10 ऑगस्ट ₹2,000 ATM withdrawal.",
    BANK_TIMINGS:"डेमोसाठी शाखेची वेळ सकाळी 10 ते संध्याकाळी 4 आहे. सुट्टीच्या दिवशी वेळ बदलू शकते.",
    NEARBY_BRANCH:"डेमोमध्ये Civil Lines, Prayagraj येथील SBI शाखा दाखवली आहे. प्रत्यक्ष अंतरासाठी location permission आणि live service आवश्यक आहे.",
    ATM:"डेमोमध्ये Civil Lines, Prayagraj येथील SBI ATM दाखवला आहे. प्रत्यक्ष ATM शोधण्यासाठी location permission आवश्यक आहे.",
    IFSC:"प्रोटोटाइपमध्ये demo IFSC SBIN0000000 आहे. प्रत्यक्ष transfer साठी नेहमी अधिकृत शाखेचा IFSC वापरा.",
    ACCOUNT_TYPE:"हा प्रोटोटाइप demo Savings Account वापरतो.",
    MAX_BALANCE:"सर्व SBI खात्यांसाठी एकच maximum balance नसतो. तो account type आणि नियमांवर अवलंबून असतो.",
    MINIMUM_BALANCE:"Minimum balance चे नियम account variant नुसार बदलतात. तुमच्या account च्या अधिकृत अटी तपासा.",
    UPI_FAILED:"UPI payment failed असल्यास transaction status आणि पैसे debit झाले आहेत का ते तपासा. Transaction ID जतन करा आणि गरज असल्यास अधिकृत UPI/bank channel वर complaint करा.",
    UPI_PENDING:"UPI payment pending असल्यास लगेच पुन्हा payment करू नका. Transaction status तपासा.",
    CARD_BLOCK:"Debit card हरवला किंवा चोरीला गेला असल्यास अधिकृत bank channel मधून तो त्वरित block/hotlist करा.",
    PIN:"PIN विसरल्यास अधिकृत ATM/mobile/internet banking reset प्रक्रिया वापरा. PIN कोणालाही सांगू नका.",
    FRAUD:"अनधिकृत transaction दिसल्यास त्वरित card/account सुरक्षित करा आणि अधिकृत bank channel वर report करा. OTP/PIN कधीही सांगू नका.",
    HELP:"तुम्ही balance, account number, mini statement, branch/ATM, IFSC, bank timing, UPI, card, PIN, KYC, cheque, cash deposit/withdrawal, charges, loan, FD, fraud आणि complaint बद्दल विचारू शकता.",
    UNKNOWN_INTENT:"मला प्रश्न पूर्णपणे समजला नाही. कृपया सोप्या शब्दांत पुन्हा विचारा."
  },
  bn: {
    CHECK_BALANCE:"আপনার ডেমো সেভিংস অ্যাকাউন্টের ব্যালেন্স ₹১২,৫০০। এটি শুধু প্রোটোটাইপের mock data।",
    ACCOUNT_NUMBER:"আপনার ডেমো অ্যাকাউন্টের শেষ চারটি সংখ্যা 1234। নিরাপত্তার জন্য সম্পূর্ণ অ্যাকাউন্ট নম্বর বলা হয় না।",
    MINI_STATEMENT:"সাম্প্রতিক লেনদেন: 14 আগস্ট ₹৫,০০০ cash deposit, 12 আগস্ট ₹৫০০ UPI payment এবং 10 আগস্ট ₹২,০০০ ATM withdrawal।",
    BANK_TIMINGS:"ডেমোর জন্য শাখার সময় সকাল ১০টা থেকে বিকেল ৪টা। ছুটির দিনে সময় আলাদা হতে পারে।",
    NEARBY_BRANCH:"ডেমোতে Civil Lines, Prayagraj-এর একটি SBI শাখা দেখানো হয়েছে। বাস্তব দূরত্বের জন্য location permission এবং live service দরকার।",
    ATM:"ডেমোতে Civil Lines, Prayagraj-এর একটি SBI ATM দেখানো হয়েছে। বাস্তব ATM খুঁজতে location permission দরকার।",
    IFSC:"প্রোটোটাইপে demo IFSC SBIN0000000 ব্যবহার করা হয়েছে। বাস্তব transfer-এর জন্য আপনার শাখার official IFSC ব্যবহার করুন।",
    MAX_BALANCE:"সব SBI অ্যাকাউন্টের জন্য একটিমাত্র maximum balance নেই। এটি account type ও নিয়মের উপর নির্ভর করে।",
    UPI_FAILED:"UPI payment failed হলে transaction status এবং account debit হয়েছে কি না দেখুন। Transaction ID রেখে official UPI/bank channel-এ complaint করুন।",
    UPI_PENDING:"UPI payment pending হলে সঙ্গে সঙ্গে আবার payment করবেন না। আগে transaction status দেখুন।",
    CARD_BLOCK:"Debit card হারিয়ে গেলে বা চুরি হলে official bank channel দিয়ে দ্রুত block/hotlist করুন।",
    PIN:"PIN ভুলে গেলে official reset process ব্যবহার করুন। PIN কাউকে বলবেন না।",
    FRAUD:"অননুমোদিত transaction দেখলে দ্রুত account/card নিরাপদ করুন এবং official bank channel-এ report করুন। OTP/PIN কাউকে দেবেন না।",
    HELP:"আপনি balance, account number, mini statement, branch/ATM, IFSC, bank timing, UPI, card, PIN, KYC, cheque, cash deposit/withdrawal, charges, loan, FD, fraud এবং complaint সম্পর্কে প্রশ্ন করতে পারেন।",
    UNKNOWN_INTENT:"আমি প্রশ্নটি পুরোপুরি বুঝতে পারিনি। সহজ ভাষায় আবার জিজ্ঞাসা করুন।"
  }
};

function normalize(s) {
  let t = String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[!?.,;:।,¿¡]/g, " ")
    .replace(/[-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Speech recognition often inserts spaces into acronyms:
  // "u p i", "यू पी आई", "ए टी एम", etc. Canonicalize them so
  // intent detection does not depend on one exact ASR transcription.
  const acronymGroups = [
    [/\bu\s*p\s*i\b/g, "upi"],
    [/\ba\s*t\s*m\b/g, "atm"],
    [/\bn\s*e\s*f\s*t\b/g, "neft"],
    [/\br\s*t\s*g\s*s\b/g, "rtgs"],
    [/\bi\s*m\s*p\s*s\b/g, "imps"],
    [/\bk\s*y\s*c\b/g, "kyc"],
    [/\bp\s*i\s*n\b/g, "pin"],
    [/\bo\s*t\s*p\b/g, "otp"],
    [/\bc\s*v\s*v\b/g, "cvv"],
    [/यू\s*पी\s*आई/g, "upi"],
    [/ए\s*टी\s*एम/g, "atm"],
    [/एन\s*ई\s*एफ\s*टी/g, "neft"],
    [/आर\s*टी\s*जी\s*एस/g, "rtgs"],
    [/आई\s*एम\s*पी\s*एस/g, "imps"],
    [/के\s*वाई\s*सी/g, "kyc"],
    [/प\s*ि\s*न/g, "pin"],
    [/ओ\s*टी\s*पी/g, "otp"]
  ];
  for (const [re, replacement] of acronymGroups) t = t.replace(re, replacement);
  return t.replace(/\s+/g, " ").trim();
}

function hasAny(t, words) {
  return words.some(w => t.includes(normalize(w)));
}

function tokenScore(t, key) {
  const k = normalize(key);
  if (!k) return 0;
  const words = k.split(" ").filter(Boolean);
  if (t.includes(k)) return words.length >= 2 ? 30 + Math.min(10, k.length / 5) : 8;
  const tt = new Set(t.split(" "));
  const overlap = words.filter(x => tt.has(x)).length;
  if (!overlap) return 0;
  const ratio = overlap / words.length;
  return ratio >= 0.67 ? 4 + overlap * 2 : 0;
}
function detectIntent(text) {
  const t = normalize(text);

  // Specific intents always win over broad intents.
  if (hasAny(t, ["maximum balance","max balance","maximum amount","how much can i keep","account me maximum","अधिकतम बैलेंस","अधिकतम राशि","कितना पैसा रख सकता","kitna balance rakh sakta"])) return "MAX_BALANCE";
  if (hasAny(t, [
    "मेरे खाते में कितने पैसे","मेरे खाते में कितना पैसा","मेरे account में कितना",
    "mere account mein kitna","account mein kitne paise","account mein kitna paisa",
    "account में कितने पैसे","account में कितना पैसा","भाई account में कितने पैसे",
    "account me kitne paise","account me kitna paisa","kitne paise hain"
  ])) return "CHECK_BALANCE";
  if (hasAny(t, ["minimum balance","min balance","minimum amount","minimum balance required","न्यूनतम बैलेंस","कम से कम कितना","minimum kitna"])) return "MINIMUM_BALANCE";
  if (hasAny(t, ["account me max","max kitna","maximum kitna","maximum balance","अधिकतम"])) return "MAX_BALANCE";
  if (hasAny(t, ["close savings account","close account","account closure","खाता बंद करना","अकाउंट बंद करना"])) return "ACCOUNT_CLOSURE";
  if (hasAny(t, ["account type","which account","savings account","current account","मेरा खाता कौन सा","खाता कौन सा","account ka type"])) return "ACCOUNT_TYPE";
  // Generic acronym questions should be understood instead of falling into UNKNOWN.
  if (t === "upi" || hasAny(t, ["what is upi","upi kya hai","upi क्या है","यूपीआई क्या है"])) return "UPI_INFO";
  if (t === "pin" || hasAny(t, ["what is pin","pin kya hai","pin क्या है"])) return "PIN";
  if (t === "otp" || hasAny(t, ["what is otp","otp kya hai","otp क्या है"])) return "OTP_SAFETY";
  if (hasAny(t, ["upi pin","यूपीआई पिन","upi pin भूल","upi pin बदल"])) return "UPI_PIN";
  if (hasAny(t, ["upi pending","यूपीआई पेंडिंग","payment pending","transaction pending"])) return "UPI_PENDING";
  if (hasAny(t, ["upi limit","यूपीआई लिमिट","fund transfer limit","transfer limit"])) return "TRANSFER_LIMIT";
  if (hasAny(t, ["cash withdrawal limit","atm limit","daily atm limit","card limit","एटीएम लिमिट","कार्ड लिमिट"])) return "CARD_LIMIT";
  if (hasAny(t, ["cash deposit machine","cdm","cash deposit atm","सीडीएम"])) return "CASH_DEPOSIT_MACHINE";
  if (hasAny(t, ["cheque deposit","check deposit","चेक जमा","cheque book","check book","chequebook"])) return "CHEQUE";
  if (hasAny(t, ["cash deposit","deposit cash","cash जमा","नकद जमा","branch me cash"])) return "CASH_DEPOSIT";
  if (hasAny(t, ["bank holiday","holiday list","बैंक की छुट्टी","बैंक छुट्टी","bank holidays"])) return "HOLIDAY_BANK";
  if (hasAny(t, ["update registered mobile"])) return "MOBILE_UPDATE";
  if (hasAny(t, ["account active","account status","खाता active","खाता सक्रिय","account dormant"])) return "ACCOUNT_STATUS";
  if (hasAny(t, ["card expiry","expired card","card expire","कार्ड एक्सपायर"])) return "CARD_EXPIRY";
  if (hasAny(t, ["activate card","card activation","activate debit card","कार्ड एक्टिवेट"])) return "CARD_ACTIVATION";
  if (hasAny(t, ["unblock card","card unblock","डेबिट कार्ड अनब्लॉक","कार्ड अनब्लॉक"])) return "CARD_UNBLOCK";
  if (hasAny(t, ["contactless card","tap to pay","contactless payment","कॉन्टैक्टलेस"])) return "CONTACTLESS";
  if (hasAny(t, ["international card","international transaction","international payment","foreign transaction","विदेश में कार्ड"])) return "INTERNATIONAL_CARD";
  if (hasAny(t, ["close account","account closure","खाता बंद करना","अकाउंट बंद करना"])) return "ACCOUNT_CLOSURE";
  if (hasAny(t, ["branch transfer","change branch","home branch change","branch change","होम ब्रांच"])) return "BRANCH_TRANSFER";
  if (hasAny(t, ["dormant account","inactive account","inoperative account","डॉर्मेंट अकाउंट","निष्क्रिय खाता"])) return "DORMANT";
  if (hasAny(t, ["phishing","fake link","fake sms","fake call","phishing scam","फर्जी लिंक","फर्जी sms","फर्जी कॉल"])) return "PHISHING";
  if (hasAny(t, ["atm card retained","atm swallowed","card stuck in atm","atm card swallowed","एटीएम ने कार्ड रख लिया","एटीएम में कार्ड फंस गया","atm ने card रख लिया"])) return "ATM_RETENTION";
  if (hasAny(t, ["atm receipt","cash withdrawal receipt","एटीएम रसीद"])) return "ATM_RECEIPT";

  if (hasAny(t, ["upi"]) && hasAny(t, ["receiver","recipient","not received","paisa nahi mila","पैसा नहीं मिला","सामने वाले","गलत id","गलत आईडी","wrong id","wrong upi","galat","गलत"])) return "UPI_NOT_RECEIVED";
  if (hasAny(t, ["upi"]) && hasAny(t, ["fail","failed","failure","नहीं हुआ","फेल","काम नहीं"])) return "UPI_FAILED";
  if (hasAny(t, ["upi"]) && hasAny(t, ["pending","atka","लंबित","पेंडिंग"])) return "UPI_PENDING";
  if (hasAny(t, ["upi"]) && hasAny(t, ["wrong upi","wrong id","गलत upi","गलत यूपीआई","गलत id","गलत आईडी"])) return "UPI_NOT_RECEIVED";
  if (hasAny(t, ["upi"]) && hasAny(t, ["money not received","payment not received","paisa nahi mila","पैसा नहीं मिला","सामने वाले को नहीं मिला","receiver did not get"])) return "UPI_NOT_RECEIVED";

  if (hasAny(t, ["cash withdraw","cash withdrawal","cash withdrawal नहीं","cash withdraw nahi","cash नहीं निकला"])) {
    if (hasAny(t, ["cut","कट","debit","debited","deducted","account"])) return "ATM_CASH_NOT_RECEIVED";
  }
  if (hasAny(t, ["atm","एटीएम"]) && hasAny(t, ["cash","पैसा","withdraw","निकला","नहीं दिया","नहीं मिला"]) &&
      hasAny(t, ["debit","debited","कट","कट गया","deducted","नहीं निकला","नहीं दिया","cash not"])) return "ATM_CASH_NOT_RECEIVED";

  if (hasAny(t, ["card","कार्ड"]) && hasAny(t, ["lost","खो गया","खोया","चोरी","गुम"])) return "CARD_BLOCK";
  if (hasAny(t, ["loan","लोन"]) && hasAny(t, ["emi","ईएमआई","installment","किश्त"])) return "LOAN_EMI";
  if (hasAny(t, ["otp","ओटीपी"]) && hasAny(t, ["share","देना","बताएं","बताओ","share karna","किसी को"])) return "PHISHING";
  if (hasAny(t, ["account security","secure account","account ko secure","खाता सुरक्षित","अकाउंट सुरक्षित"])) return "BANK_TRANSFER_SAFETY";
  if (hasAny(t, ["account fraud","fraud","unauthorized transaction","unknown transaction","अनजान ट्रांजैक्शन","अनधिकृत लेनदेन","फ्रॉड"])) return "FRAUD";
  if (hasAny(t, ["bank holiday","holiday list","बैंक की छुट्टी","बैंक छुट्टी","bank holiday"]) ) return "HOLIDAY_BANK";
  if (hasAny(t, ["fourth saturday","second saturday","third saturday","first saturday","fifth saturday","saturday","शनिवार"]) && (hasAny(t, ["bank","branch","बैंक","शाखा"]) || hasAny(t, ["holiday","closed","open","working"]))) return "SATURDAY_BANK";
  if (hasAny(t, ["sunday","रविवार"]) && hasAny(t, ["bank","branch","बैंक","शाखा"])) return "SUNDAY_BANK";
  if (hasAny(t, ["lunch","लंच"])) return "BRANCH_LUNCH";
  if (hasAny(t, ["cheque","चेक"]) && hasAny(t, ["deposit","जमा"])) return "CHEQUE";
  if (hasAny(t, ["today","aaj","आज"]) && hasAny(t, ["bank","बैंक","branch","शाखा"])) return "TODAY_BANK";

  let best = { intent: "UNKNOWN_INTENT", score: 0 };
  for (const p of intentPatterns) {
    let score = 0;
    for (const k of p.keys) score += tokenScore(t, k);

    // Intent-specific contextual boosts reduce collisions between broad terms.
    if (p.intent === "UPI_FAILED" && hasAny(t, ["upi"])) score += 8;
    if (p.intent === "UPI_PENDING" && hasAny(t, ["upi"])) score += 8;
    if (p.intent === "LOAN_EMI" && hasAny(t, ["emi","ईएमआई"])) score += 10;
    if (p.intent === "ATM_CASH_NOT_RECEIVED" && hasAny(t, ["atm","एटीएम"])) score += 8;
    if (p.intent === "MAX_BALANCE" && hasAny(t, ["maximum","maximum balance","max","अधिकतम"])) score += 10;
    if (p.intent === "MINIMUM_BALANCE" && hasAny(t, ["minimum","न्यूनतम"])) score += 10;

    if (score > best.score) best = { intent: p.intent, score };
  }
  return best.intent;
}

// Compact built-in responses for common demo intents. For the remaining intents,
// Bhashini translation can be enabled with environment variables; otherwise the
// assistant safely falls back to the English response instead of inventing facts.
const multilingualCore = {
  mr: {
    CHECK_BALANCE:"तुमच्या डेमो सेव्हिंग्स खात्यातील उपलब्ध शिल्लक ₹25,400 आहे. हा फक्त प्रोटोटाइपमधील mock data आहे.",
    MAX_BALANCE:"प्रत्येक SBI खात्यासाठी एकच सार्वत्रिक कमाल शिल्लक नसते. ती खात्याच्या प्रकारावर आणि लागू नियमांवर अवलंबून असते.",
    UPI_FAILED:"UPI पेमेंट अयशस्वी झाले असल्यास transaction status आणि रक्कम खात्यातून वजा झाली आहे का ते तपासा.",
    UPI_PENDING:"UPI पेमेंट pending असल्यास लगेच पुन्हा पेमेंट करू नका. आधी transaction status तपासा.",
    CARD_BLOCK:"डेबिट कार्ड हरवले किंवा चोरीला गेले असल्यास अधिकृत बँक माध्यमातून ते त्वरित block किंवा hotlist करा.",
    KYC:"KYC update करण्यासाठी अधिकृत बँक माध्यम किंवा शाखेचा वापर करा. OTP किंवा PIN कोणालाही सांगू नका.",
    MINI_STATEMENT:"तुमच्या डेमो खात्यातील अलीकडील व्यवहार: ₹5,000 cash deposit, ₹500 UPI payment आणि ₹2,000 ATM withdrawal."
  },
  bn: {
    CHECK_BALANCE:"আপনার ডেমো সেভিংস অ্যাকাউন্টে উপলব্ধ ব্যালেন্স ₹25,400। এটি শুধু প্রোটোটাইপের mock data।",
    MAX_BALANCE:"প্রতিটি SBI অ্যাকাউন্টের জন্য একটি নির্দিষ্ট সর্বোচ্চ ব্যালেন্স নেই। এটি অ্যাকাউন্টের ধরন ও নিয়মের উপর নির্ভর করে।",
    UPI_FAILED:"UPI পেমেন্ট ব্যর্থ হলে transaction status এবং অ্যাকাউন্ট থেকে টাকা কাটা হয়েছে কি না দেখুন।",
    UPI_PENDING:"UPI পেমেন্ট pending থাকলে সঙ্গে সঙ্গে আবার পেমেন্ট করবেন না। আগে transaction status দেখুন।",
    CARD_BLOCK:"ডেবিট কার্ড হারিয়ে গেলে বা চুরি হলে অফিসিয়াল ব্যাংক চ্যানেলের মাধ্যমে দ্রুত block বা hotlist করুন।",
    KYC:"KYC update করতে অফিসিয়াল ব্যাংক চ্যানেল বা শাখা ব্যবহার করুন। OTP বা PIN কাউকে বলবেন না।",
    MINI_STATEMENT:"ডেমো অ্যাকাউন্টের সাম্প্রতিক লেনদেন: ₹5,000 cash deposit, ₹500 UPI payment এবং ₹2,000 ATM withdrawal।"
  },
  gu: {
    CHECK_BALANCE:"તમારા ડેમો સેવિંગ્સ ખાતામાં ઉપલબ્ધ બેલેન્સ ₹25,400 છે. આ માત્ર પ્રોટોટાઇપનું mock data છે.",
    MAX_BALANCE:"દરેક SBI ખાતા માટે એક જ universal maximum balance નથી. તે ખાતાના પ્રકાર અને નિયમો પર આધારિત છે.",
    UPI_FAILED:"UPI payment fail થાય તો transaction status અને ખાતામાંથી રકમ કપાઈ છે કે નહીં તે તપાસો.",
    UPI_PENDING:"UPI payment pending હોય તો તરત ફરીથી payment ન કરો. પહેલાં transaction status તપાસો.",
    CARD_BLOCK:"ડેબિટ કાર્ડ ખોવાઈ જાય અથવા ચોરી થાય તો official bank channelથી તરત block અથવા hotlist કરો.",
    KYC:"KYC update માટે official bank channel અથવા branchનો ઉપયોગ કરો. OTP અથવા PIN કોઈને ન આપો.",
    MINI_STATEMENT:"ડેમો ખાતાની તાજેતરની transactions: ₹5,000 cash deposit, ₹500 UPI payment અને ₹2,000 ATM withdrawal."
  },
  pa: {
    CHECK_BALANCE:"ਤੁਹਾਡੇ ਡੈਮੋ ਸੇਵਿੰਗਜ਼ ਖਾਤੇ ਵਿੱਚ ਉਪਲਬਧ ਬੈਲੈਂਸ ₹25,400 ਹੈ। ਇਹ ਸਿਰਫ਼ ਪ੍ਰੋਟੋਟਾਈਪ ਦਾ mock data ਹੈ।",
    MAX_BALANCE:"ਹਰ SBI ਖਾਤੇ ਲਈ ਇੱਕੋ universal maximum balance ਨਹੀਂ ਹੁੰਦਾ। ਇਹ ਖਾਤੇ ਦੀ ਕਿਸਮ ਅਤੇ ਨਿਯਮਾਂ 'ਤੇ ਨਿਰਭਰ ਕਰਦਾ ਹੈ।",
    UPI_FAILED:"ਜੇ UPI payment fail ਹੋ ਗਈ ਹੈ ਤਾਂ transaction status ਅਤੇ account debit ਹੋਇਆ ਹੈ ਜਾਂ ਨਹੀਂ, ਇਹ ਚੈੱਕ ਕਰੋ।",
    UPI_PENDING:"ਜੇ UPI payment pending ਹੈ ਤਾਂ ਤੁਰੰਤ ਦੁਬਾਰਾ payment ਨਾ ਕਰੋ। ਪਹਿਲਾਂ transaction status ਚੈੱਕ ਕਰੋ।",
    CARD_BLOCK:"ਜੇ debit card ਗੁੰਮ ਜਾਂ ਚੋਰੀ ਹੋ ਗਿਆ ਹੈ ਤਾਂ official bank channel ਰਾਹੀਂ ਤੁਰੰਤ block ਜਾਂ hotlist ਕਰੋ।",
    KYC:"KYC update ਕਰਨ ਲਈ official bank channel ਜਾਂ branch ਵਰਤੋ। OTP ਜਾਂ PIN ਕਿਸੇ ਨੂੰ ਨਾ ਦਿਓ।",
    MINI_STATEMENT:"ਡੈਮੋ ਖਾਤੇ ਦੀਆਂ ਹਾਲੀਆ transactions: ₹5,000 cash deposit, ₹500 UPI payment ਅਤੇ ₹2,000 ATM withdrawal।"
  },
  ta: {
    CHECK_BALANCE:"உங்கள் டெமோ சேமிப்பு கணக்கில் உள்ள இருப்பு ₹25,400. இது prototype-இன் mock data.",
    MAX_BALANCE:"ஒவ்வொரு SBI கணக்கிற்கும் ஒரே universal maximum balance இல்லை. அது கணக்கு வகை மற்றும் விதிமுறைகளுக்கு ஏற்ப மாறும்.",
    UPI_FAILED:"UPI payment தோல்வியடைந்தால் transaction status மற்றும் பணம் debit ஆனதா என்பதை சரிபார்க்கவும்.",
    UPI_PENDING:"UPI payment pending என்றால் உடனே மீண்டும் payment செய்ய வேண்டாம். முதலில் transaction status பார்க்கவும்.",
    CARD_BLOCK:"Debit card தொலைந்தால் அல்லது திருடப்பட்டால் official bank channel மூலம் உடனே block அல்லது hotlist செய்யவும்.",
    KYC:"KYC update செய்ய official bank channel அல்லது branch பயன்படுத்தவும். OTP அல்லது PIN யாரிடமும் சொல்ல வேண்டாம்.",
    MINI_STATEMENT:"டெமோ கணக்கின் சமீபத்திய transactions: ₹5,000 cash deposit, ₹500 UPI payment மற்றும் ₹2,000 ATM withdrawal."
  },
  te: {
    CHECK_BALANCE:"మీ డెమో సేవింగ్స్ ఖాతాలో అందుబాటులో ఉన్న బ్యాలెన్స్ ₹25,400. ఇది ప్రోటోటైప్ mock data మాత్రమే.",
    MAX_BALANCE:"ప్రతి SBI ఖాతాకు ఒకే universal maximum balance ఉండదు. ఇది ఖాతా రకం మరియు నిబంధనలపై ఆధారపడి ఉంటుంది.",
    UPI_FAILED:"UPI payment విఫలమైతే transaction status మరియు ఖాతా నుంచి డబ్బు debit అయిందో లేదో చూడండి.",
    UPI_PENDING:"UPI payment pending అయితే వెంటనే మళ్లీ payment చేయకండి. ముందుగా transaction status చూడండి.",
    CARD_BLOCK:"Debit card పోయినా లేదా దొంగిలించబడినా official bank channel ద్వారా వెంటనే block లేదా hotlist చేయండి.",
    KYC:"KYC update కోసం official bank channel లేదా branch ఉపయోగించండి. OTP లేదా PIN ఎవరికీ చెప్పకండి.",
    MINI_STATEMENT:"డెమో ఖాతా ఇటీవలి transactions: ₹5,000 cash deposit, ₹500 UPI payment మరియు ₹2,000 ATM withdrawal."
  },
  kn: {
    CHECK_BALANCE:"ನಿಮ್ಮ ಡೆಮೋ ಉಳಿತಾಯ ಖಾತೆಯ ಲಭ್ಯ ಬ್ಯಾಲೆನ್ಸ್ ₹25,400. ಇದು ಪ್ರೋಟೋಟೈಪ್‌ನ mock data ಮಾತ್ರ.",
    MAX_BALANCE:"ಪ್ರತಿ SBI ಖಾತೆಗೆ ಒಂದೇ universal maximum balance ಇರುವುದಿಲ್ಲ. ಅದು ಖಾತೆಯ ಪ್ರಕಾರ ಮತ್ತು ನಿಯಮಗಳ ಮೇಲೆ ಅವಲಂಬಿತವಾಗಿದೆ.",
    UPI_FAILED:"UPI payment ವಿಫಲವಾದರೆ transaction status ಮತ್ತು ಖಾತೆಯಿಂದ ಹಣ debit ಆಗಿದೆಯೇ ಎಂದು ಪರಿಶೀಲಿಸಿ.",
    UPI_PENDING:"UPI payment pending ಇದ್ದರೆ ತಕ್ಷಣ ಮತ್ತೆ payment ಮಾಡಬೇಡಿ. ಮೊದಲು transaction status ಪರಿಶೀಲಿಸಿ.",
    CARD_BLOCK:"Debit card ಕಳೆದುಹೋದರೆ ಅಥವಾ ಕಳುವಾದರೆ official bank channel ಮೂಲಕ ತಕ್ಷಣ block ಅಥವಾ hotlist ಮಾಡಿ.",
    KYC:"KYC update ಮಾಡಲು official bank channel ಅಥವಾ branch ಬಳಸಿ. OTP ಅಥವಾ PIN ಯಾರಿಗೂ ಹೇಳಬೇಡಿ.",
    MINI_STATEMENT:"ಡೆಮೋ ಖಾತೆಯ ಇತ್ತೀಚಿನ transactions: ₹5,000 cash deposit, ₹500 UPI payment ಮತ್ತು ₹2,000 ATM withdrawal."
  }
};

function getIndianWeekInfo(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone:"Asia/Kolkata", weekday:"long", day:"numeric", month:"numeric", year:"numeric" }).formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value;
  return { weekday:get("weekday"), day:Number(get("day")), month:Number(get("month")), year:Number(get("year")) };
}

function saturdayNumber(day, month, year) {
  let count = 0;
  for (let d=1; d<=day; d++) {
    const dt = new Date(Date.UTC(year, month-1, d));
    if (dt.getUTCDay() === 6) count++;
  }
  return count;
}

function currentBranchStatus() {
  const now = new Date();
  const info = getIndianWeekInfo(now);
  if (info.weekday === "Sunday") return "आज रविवार है, इसलिए सामान्य SBI branch बंद रहती है।";
  if (info.weekday === "Saturday") {
    const n = saturdayNumber(info.day, info.month, info.year);
    if (n === 2 || n === 4) return `आज महीने का ${n === 2 ? "दूसरा" : "चौथा"} शनिवार है, इसलिए सामान्य SBI branch holiday है।`;
    return `आज महीने का ${n === 1 ? "पहला" : n === 3 ? "तीसरा" : "पांचवां"} शनिवार है। सामान्य नियम में branch working day हो सकती है, लेकिन local holiday/branch schedule verify करें।`;
  }
  return "आज सामान्य weekday है। Demo branch को सुबह 10 बजे से शाम 4 बजे तक working माना गया है; local holiday होने पर schedule बदल सकता है।";
}

function getResponse(intent, lang) {
  if (intent === "CHECK_BALANCE" && lang === "hi") return "आपके डेमो सेविंग्स खाते में उपलब्ध बैलेंस पच्चीस हजार चार सौ रुपये है। यह केवल प्रोटोटाइप का mock data है।";
  if (intent === "MINI_STATEMENT" && lang === "hi") return "हाल के तीन लेन-देन: 14 अगस्त को पांच हजार रुपये cash deposit, 12 अगस्त को पांच सौ रुपये UPI payment, और 10 अगस्त को दो हजार रुपये ATM withdrawal।";
  if (intent === "TODAY_BANK" && lang === "hi") return currentBranchStatus();
  if (multilingualCore[lang]?.[intent]) return multilingualCore[lang][intent];

  const pack = replies[lang] || replies.en;
  return pack[intent] || replies.en[intent] || replies.en.UNKNOWN_INTENT;
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function serveFile(res, file) {
  const ext = path.extname(file);
  const types = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8" };
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, {error:"File not found"});
    res.writeHead(200, {"Content-Type": types[ext] || "application/octet-stream"});
    res.end(data);
  });
}

function readBody(req, cb) {
  let body = "";
  req.on("data", c => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on("end", () => {
    try { cb(null, JSON.parse(body || "{}")); }
    catch (e) { cb(e); }
  });
}


const SARVAM_API_URL = "https://api.sarvam.ai";
const SARVAM_STT_MODEL = "saaras:v3";
const SARVAM_TTS_MODEL = "bulbul:v3";
const SARVAM_TTS_LANGUAGES = new Set(["hi", "en", "bn", "gu", "kn", "ml", "mr", "or", "pa", "ta", "te"]);
const SARVAM_TTS_SPEAKERS = { hi:"shubh", en:"shubh", bn:"rehan", gu:"ratan", kn:"shubh", ml:"shubh", mr:"ratan", or:"shubh", pa:"mani", ta:"ratan", te:"shubh" };

const sarvamLanguageCodes = {
  hi:"hi-IN", en:"en-IN", as:"as-IN", bn:"bn-IN", brx:"brx-IN", doi:"doi-IN",
  gu:"gu-IN", kn:"kn-IN", ks:"ks-IN", kok:"kok-IN", mai:"mai-IN", ml:"ml-IN",
  mni:"mni-IN", mr:"mr-IN", ne:"ne-IN", or:"od-IN", pa:"pa-IN", sa:"sa-IN",
  sat:"sat-IN", sd:"sd-IN", ta:"ta-IN", te:"te-IN", ur:"ur-IN"
};

function getSarvamKey() {
  return process.env.SARVAM_API_KEY || process.env.SARVAM_API_SUBSCRIPTION_KEY || "";
}

function requireSarvamKey(res) {
  const key = getSarvamKey();
  if (!key) {
    json(res, 503, {error:"SARVAM_API_KEY is not configured. Add it to .env and restart the server."});
    return null;
  }
  return key;
}

function decodeBase64Audio(value) {
  if (typeof value !== "string" || !value) throw new Error("audioBase64 is required");
  const match = value.match(/^data:[^;]+;base64,(.+)$/s);
  return Buffer.from(match ? match[1] : value, "base64");
}

async function sarvamSpeechToText(body) {
  const key = getSarvamKey();
  if (!key) throw Object.assign(new Error("SARVAM_API_KEY is not configured"), {status:503});
  const audio = decodeBase64Audio(body.audioBase64);
  if (!audio.length) throw Object.assign(new Error("Empty audio recording"), {status:400});
  if (audio.length > 8 * 1024 * 1024) throw Object.assign(new Error("Audio recording is too large"), {status:413});

  // Browsers commonly send `audio/webm;codecs=opus`. Sarvam's upload
  // validator accepts `audio/webm` but rejects MIME parameters such as
  // `;codecs=opus`, so normalize the MIME type before creating the multipart file.
  const rawMimeType = String(body.mimeType || "audio/webm");
  const mimeType = rawMimeType.split(";", 1)[0].trim().toLowerCase() || "audio/webm";
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("file", new File([audio], `recording.${ext}`, {type: mimeType}));
  form.append("model", SARVAM_STT_MODEL);
  form.append("mode", "transcribe");
  form.append("language_code", sarvamLanguageCodes[body.language] || "unknown");

  const response = await fetch(`${SARVAM_API_URL}/speech-to-text`, {
    method:"POST",
    headers:{"api-subscription-key":key},
    body:form
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data?.detail || data?.message || data?.error || data;
    const message = typeof raw === "string" ? raw : (raw?.message || raw?.msg || JSON.stringify(raw));
    throw Object.assign(new Error(String(message || `Sarvam STT failed (${response.status})`)), {status:response.status, details:data});
  }
  return data;
}

async function sarvamTextToSpeech(body) {
  const key = getSarvamKey();
  if (!key) throw Object.assign(new Error("SARVAM_API_KEY is not configured"), {status:503});
  const text = String(body.text || "").trim();
  if (!text) throw Object.assign(new Error("text is required"), {status:400});
  if (text.length > 2500) throw Object.assign(new Error("Text is too long for Bulbul v3 REST (max 2500 characters)"), {status:400});

  const language = body.language || "hi";
  if (!SARVAM_TTS_LANGUAGES.has(language)) {
    return {supported:false, language, message:"Sarvam Bulbul v3 TTS currently supports 11 languages. The frontend will use browser TTS for this language."};
  }

  const payload = {
    text,
    language_code: sarvamLanguageCodes[language],
    speaker: SARVAM_TTS_SPEAKERS[language] || "shubh",
    model: SARVAM_TTS_MODEL,
    pace: Math.min(2, Math.max(0.5, Number(body.pace) || 1)),
    speech_sample_rate: 24000,
    output_audio_codec: "wav"
  };

  const response = await fetch(`${SARVAM_API_URL}/text-to-speech`, {
    method:"POST",
    headers:{"api-subscription-key":key, "Content-Type":"application/json"},
    body:JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = data?.detail || data?.message || data?.error || data;
    const message = typeof raw === "string" ? raw : (raw?.message || raw?.msg || JSON.stringify(raw));
    throw Object.assign(new Error(String(message || `Sarvam TTS failed (${response.status})`)), {status:response.status, details:data});
  }
  if (!data?.audios?.[0]) throw Object.assign(new Error("Sarvam TTS returned no audio"), {status:502, details:data});
  return {supported:true, language, audioBase64:data.audios[0], mimeType:"audio/wav", requestId:data.request_id || null};
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {"Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type"});
    return res.end();
  }

  if (req.method === "GET" && u.pathname === "/api/health") {
    return json(res, 200, {ok:true, service:"SBI Voice Banking Assistant", mode:getSarvamKey() ? "sarvam-voice" : "offline-demo", sarvamConfigured:Boolean(getSarvamKey())});
  }

  if (req.method === "GET" && u.pathname === "/api/mock-data") {
    return json(res, 200, db);
  }

  if (req.method === "POST" && u.pathname === "/api/detect-intent") {
    return readBody(req, (err, body) => {
      if (err || !body.transcript) return json(res, 400, {error:"transcript is required"});
      const intent = detectIntent(body.transcript);
      const language = body.language || "hi";
      return json(res, 200, {
        requestId: body.requestId ?? null,
        intent,
        responseText: getResponse(intent, language),
        safety: "Demo only. Never share OTP, PIN, CVV, password or full account number."
      });
    });
  }

  if (req.method === "POST" && u.pathname === "/api/speech-to-text") {
    return readBody(req, async (err, body) => {
      if (err) return json(res, 400, {error:"Invalid JSON request"});
      if (!requireSarvamKey(res)) return;
      try {
        const data = await sarvamSpeechToText(body);
        return json(res, 200, data);
      } catch (e) {
        console.error("Sarvam STT error:", e.message);
        return json(res, e.status || 502, {error:e.message || "Sarvam STT request failed"});
      }
    });
  }

  if (req.method === "POST" && u.pathname === "/api/text-to-speech") {
    return readBody(req, async (err, body) => {
      if (err) return json(res, 400, {error:"Invalid JSON request"});
      if (!body.text) return json(res, 400, {error:"text is required"});
      if (!requireSarvamKey(res)) return;
      try {
        const data = await sarvamTextToSpeech(body);
        return json(res, 200, data);
      } catch (e) {
        console.error("Sarvam TTS error:", e.message);
        return json(res, e.status || 502, {error:e.message || "Sarvam TTS request failed"});
      }
    });
  }

  let pathname = decodeURIComponent(u.pathname);
  if (pathname === "/") pathname = "/index.html";
  const safe = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  return serveFile(res, path.join(PUBLIC, safe));
});

function startServer(port) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE") {
      const fallback = port + 1;
      console.log(`\nPort ${port} is already in use. Trying port ${fallback}...`);
      startServer(fallback);
      return;
    }
    console.error("Could not start server:", err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`\nSBI Voice Banking Assistant running at http://localhost:${port}`);
    console.log("Open that address in Chrome/Edge and allow microphone access.\n");
  });
}

startServer(Number(PORT));
