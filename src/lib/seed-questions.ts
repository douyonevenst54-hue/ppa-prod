import { prisma } from "./prisma";

const questions = [
  // ── FINANCE EASY ──
  { text: "What does 'IPO' stand for?", options: ["Initial Public Offering", "Internal Price Order", "International Payment Option", "Investor Profit Obligation"], correctAnswer: "Initial Public Offering", category: "FINANCE", difficulty: "EASY" },
  { text: "What is Bitcoin?", options: ["A decentralized digital currency", "A government-issued currency", "A type of stock", "A banking software"], correctAnswer: "A decentralized digital currency", category: "FINANCE", difficulty: "EASY" },
  { text: "What does 'bull market' mean?", options: ["Rising prices", "Falling prices", "Stable prices", "Volatile prices"], correctAnswer: "Rising prices", category: "FINANCE", difficulty: "EASY" },
  { text: "What is a stock dividend?", options: ["A share of company profits paid to shareholders", "A loan from a company", "A type of bond", "A company merger"], correctAnswer: "A share of company profits paid to shareholders", category: "FINANCE", difficulty: "EASY" },
  { text: "What does ETF stand for?", options: ["Exchange Traded Fund", "Equity Transfer Fee", "Electronic Trading Format", "External Tax Fund"], correctAnswer: "Exchange Traded Fund", category: "FINANCE", difficulty: "EASY" },

  // ── FINANCE MEDIUM ──
  { text: "What is the current maximum supply of Bitcoin?", options: ["21 million", "100 million", "18 million", "50 million"], correctAnswer: "21 million", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "Which company was the first to reach a $1 trillion market cap?", options: ["Apple", "Microsoft", "Amazon", "Google"], correctAnswer: "Apple", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "What is Ethereum primarily used for?", options: ["Smart contracts and decentralized apps", "Online payments only", "Gold trading", "Stock exchange"], correctAnswer: "Smart contracts and decentralized apps", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "What is a 'bear market' typically defined as?", options: ["A decline of 20% or more from recent highs", "A decline of 5% from recent highs", "Any market downturn", "A market crash of 50%"], correctAnswer: "A decline of 20% or more from recent highs", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "What is the Federal Reserve's primary mandate?", options: ["Maximum employment and stable prices", "Maximize GDP growth", "Control government spending", "Regulate stock markets"], correctAnswer: "Maximum employment and stable prices", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "What does DeFi stand for?", options: ["Decentralized Finance", "Digital Financial Index", "Deferred Financial Interest", "Direct Fund Investment"], correctAnswer: "Decentralized Finance", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "What is a P/E ratio used to measure?", options: ["How expensive a stock is relative to earnings", "Company debt levels", "Dividend payments", "Market volatility"], correctAnswer: "How expensive a stock is relative to earnings", category: "FINANCE", difficulty: "MEDIUM" },
  { text: "What blockchain does Pi Network run on?", options: ["Its own Stellar-based blockchain", "Ethereum", "Bitcoin", "Solana"], correctAnswer: "Its own Stellar-based blockchain", category: "FINANCE", difficulty: "MEDIUM" },

  // ── FINANCE HARD ──
  { text: "What is the Sharpe ratio used to measure?", options: ["Risk-adjusted return", "Total portfolio return", "Market beta", "Dividend yield"], correctAnswer: "Risk-adjusted return", category: "FINANCE", difficulty: "HARD" },
  { text: "What is the difference between Layer 1 and Layer 2 blockchain solutions?", options: ["L1 is the base blockchain, L2 builds on top to improve scalability", "L1 is faster than L2", "L2 is more secure than L1", "They are the same thing"], correctAnswer: "L1 is the base blockchain, L2 builds on top to improve scalability", category: "FINANCE", difficulty: "HARD" },

  // ── TECH EASY ──
  { text: "What does 'AI' stand for?", options: ["Artificial Intelligence", "Automated Interface", "Advanced Internet", "Algorithmic Input"], correctAnswer: "Artificial Intelligence", category: "TECH", difficulty: "EASY" },
  { text: "What company makes the iPhone?", options: ["Apple", "Samsung", "Google", "Microsoft"], correctAnswer: "Apple", category: "TECH", difficulty: "EASY" },
  { text: "What does 'URL' stand for?", options: ["Uniform Resource Locator", "Universal Remote Link", "Unified Reference List", "User Resource Layer"], correctAnswer: "Uniform Resource Locator", category: "TECH", difficulty: "EASY" },
  { text: "What programming language is most used for web development?", options: ["JavaScript", "Python", "Java", "C++"], correctAnswer: "JavaScript", category: "TECH", difficulty: "EASY" },
  { text: "What does 'Wi-Fi' allow devices to do?", options: ["Connect to the internet wirelessly", "Make phone calls", "Send text messages", "Store data locally"], correctAnswer: "Connect to the internet wirelessly", category: "TECH", difficulty: "EASY" },
  { text: "What is an operating system?", options: ["Software that manages hardware and software resources", "A type of processor", "A storage device", "An internet browser"], correctAnswer: "Software that manages hardware and software resources", category: "TECH", difficulty: "EASY" },

  // ── TECH MEDIUM ──
  { text: "What does 'API' stand for?", options: ["Application Programming Interface", "Automated Processing Input", "Advanced Program Integration", "Application Protocol Interface"], correctAnswer: "Application Programming Interface", category: "TECH", difficulty: "MEDIUM" },
  { text: "What is machine learning?", options: ["A subset of AI where systems learn from data", "Programming computers manually", "A type of database", "A networking protocol"], correctAnswer: "A subset of AI where systems learn from data", category: "TECH", difficulty: "MEDIUM" },
  { text: "What company developed the Android operating system?", options: ["Google", "Apple", "Microsoft", "Samsung"], correctAnswer: "Google", category: "TECH", difficulty: "MEDIUM" },
  { text: "What is cloud computing?", options: ["Delivering computing services over the internet", "Local data storage", "A type of processor", "Physical server management"], correctAnswer: "Delivering computing services over the internet", category: "TECH", difficulty: "MEDIUM" },
  { text: "What is the purpose of a VPN?", options: ["Encrypt internet connection and hide IP address", "Speed up internet connection", "Block all ads", "Increase storage space"], correctAnswer: "Encrypt internet connection and hide IP address", category: "TECH", difficulty: "MEDIUM" },
  { text: "What does 'open source' software mean?", options: ["Source code is publicly available", "Software is free to use", "No updates are needed", "Works on all devices"], correctAnswer: "Source code is publicly available", category: "TECH", difficulty: "MEDIUM" },
  { text: "What is React primarily used for?", options: ["Building user interfaces", "Backend server logic", "Database management", "Mobile only apps"], correctAnswer: "Building user interfaces", category: "TECH", difficulty: "MEDIUM" },
  { text: "What does GPU stand for?", options: ["Graphics Processing Unit", "General Processing Unit", "Global Program Utility", "Graphical Program Uploader"], correctAnswer: "Graphics Processing Unit", category: "TECH", difficulty: "MEDIUM" },

  // ── TECH HARD ──
  { text: "What is the time complexity of binary search?", options: ["O(log n)", "O(n)", "O(n²)", "O(1)"], correctAnswer: "O(log n)", category: "TECH", difficulty: "HARD" },
  { text: "What is a smart contract?", options: ["Self-executing code stored on a blockchain", "A legal digital document", "An AI negotiation tool", "A secure email system"], correctAnswer: "Self-executing code stored on a blockchain", category: "TECH", difficulty: "HARD" },
  { text: "What does HTTPS provide over HTTP?", options: ["Encrypted communication", "Faster loading", "Better SEO", "Larger file transfers"], correctAnswer: "Encrypted communication", category: "TECH", difficulty: "HARD" },

  // ── SPORTS EASY ──
  { text: "How many players are on a basketball team on the court?", options: ["5", "6", "7", "4"], correctAnswer: "5", category: "SPORTS", difficulty: "EASY" },
  { text: "How many points is a touchdown worth in American football?", options: ["6", "7", "3", "8"], correctAnswer: "6", category: "SPORTS", difficulty: "EASY" },
  { text: "What sport is played at Wimbledon?", options: ["Tennis", "Cricket", "Golf", "Soccer"], correctAnswer: "Tennis", category: "SPORTS", difficulty: "EASY" },
  { text: "How many holes are in a standard golf course?", options: ["18", "9", "12", "24"], correctAnswer: "18", category: "SPORTS", difficulty: "EASY" },
  { text: "What country invented basketball?", options: ["USA", "Canada", "Brazil", "UK"], correctAnswer: "USA", category: "SPORTS", difficulty: "EASY" },
  { text: "How many players are on a soccer team on the field?", options: ["11", "10", "12", "9"], correctAnswer: "11", category: "SPORTS", difficulty: "EASY" },

  // ── SPORTS MEDIUM ──
  { text: "Which team has won the most NBA championships?", options: ["Boston Celtics", "Los Angeles Lakers", "Chicago Bulls", "Golden State Warriors"], correctAnswer: "Boston Celtics", category: "SPORTS", difficulty: "MEDIUM" },
  { text: "Who holds the record for most career NBA points?", options: ["LeBron James", "Kareem Abdul-Jabbar", "Michael Jordan", "Kobe Bryant"], correctAnswer: "LeBron James", category: "SPORTS", difficulty: "MEDIUM" },
  { text: "Which country has won the most FIFA World Cups?", options: ["Brazil", "Germany", "Argentina", "Italy"], correctAnswer: "Brazil", category: "SPORTS", difficulty: "MEDIUM" },
  { text: "What is the distance of a marathon?", options: ["26.2 miles", "25 miles", "30 kilometers", "24 miles"], correctAnswer: "26.2 miles", category: "SPORTS", difficulty: "MEDIUM" },
  { text: "In which sport would you perform a 'slam dunk'?", options: ["Basketball", "Volleyball", "Tennis", "Baseball"], correctAnswer: "Basketball", category: "SPORTS", difficulty: "MEDIUM" },
  { text: "What does MVP stand for in sports?", options: ["Most Valuable Player", "Maximum Victory Points", "Most Versatile Performer", "Major Victory Prize"], correctAnswer: "Most Valuable Player", category: "SPORTS", difficulty: "MEDIUM" },
  { text: "How long is an NBA game?", options: ["48 minutes", "40 minutes", "60 minutes", "45 minutes"], correctAnswer: "48 minutes", category: "SPORTS", difficulty: "MEDIUM" },

  // ── SPORTS HARD ──
  { text: "Which NFL team has appeared in the most Super Bowls?", options: ["New England Patriots", "Pittsburgh Steelers", "Dallas Cowboys", "San Francisco 49ers"], correctAnswer: "New England Patriots", category: "SPORTS", difficulty: "HARD" },
  { text: "In tennis, what is a 'Grand Slam'?", options: ["Winning all four major tournaments in one year", "Winning three sets in a row", "A serve that is unreturnable", "Winning a match without losing a game"], correctAnswer: "Winning all four major tournaments in one year", category: "SPORTS", difficulty: "HARD" },

  // ── POLITICS EASY ──
  { text: "How many branches does the US government have?", options: ["3", "2", "4", "5"], correctAnswer: "3", category: "POLITICS", difficulty: "EASY" },
  { text: "What is the United Nations?", options: ["An international organization promoting peace and cooperation", "A world government", "A military alliance", "A trade organization"], correctAnswer: "An international organization promoting peace and cooperation", category: "POLITICS", difficulty: "EASY" },
  { text: "How long is a US presidential term?", options: ["4 years", "6 years", "2 years", "5 years"], correctAnswer: "4 years", category: "POLITICS", difficulty: "EASY" },
  { text: "What is democracy?", options: ["A system where citizens elect their leaders", "Rule by a single person", "Rule by military", "Rule by religious leaders"], correctAnswer: "A system where citizens elect their leaders", category: "POLITICS", difficulty: "EASY" },

  // ── POLITICS MEDIUM ──
  { text: "What does NATO stand for?", options: ["North Atlantic Treaty Organization", "National Armed Treaty Operations", "Northern Alliance Treaty Office", "Naval Atlantic Trade Organization"], correctAnswer: "North Atlantic Treaty Organization", category: "POLITICS", difficulty: "MEDIUM" },
  { text: "Which amendment to the US Constitution abolished slavery?", options: ["13th", "14th", "15th", "12th"], correctAnswer: "13th", category: "POLITICS", difficulty: "MEDIUM" },
  { text: "What is the EU?", options: ["A political and economic union of European countries", "A European military alliance", "A European trade zone only", "A currency union only"], correctAnswer: "A political and economic union of European countries", category: "POLITICS", difficulty: "MEDIUM" },
  { text: "What is the G20?", options: ["A forum for 20 major world economies", "A military alliance", "A trade agreement", "A United Nations committee"], correctAnswer: "A forum for 20 major world economies", category: "POLITICS", difficulty: "MEDIUM" },
  { text: "How many permanent members does the UN Security Council have?", options: ["5", "10", "15", "7"], correctAnswer: "5", category: "POLITICS", difficulty: "MEDIUM" },

  // ── POLITICS HARD ──
  { text: "What is gerrymandering?", options: ["Manipulating electoral district boundaries for political advantage", "A form of voter fraud", "A type of election system", "Changing voting laws"], correctAnswer: "Manipulating electoral district boundaries for political advantage", category: "POLITICS", difficulty: "HARD" },
  { text: "What is the doctrine of 'separation of powers'?", options: ["Dividing government into branches to prevent abuse of power", "Separating church and state", "Dividing military and civilian power", "Separating federal and state governments"], correctAnswer: "Dividing government into branches to prevent abuse of power", category: "POLITICS", difficulty: "HARD" },

  // ── GENERAL EASY ──
  { text: "What is the largest planet in our solar system?", options: ["Jupiter", "Saturn", "Neptune", "Earth"], correctAnswer: "Jupiter", category: "GENERAL", difficulty: "EASY" },
  { text: "How many continents are there on Earth?", options: ["7", "6", "8", "5"], correctAnswer: "7", category: "GENERAL", difficulty: "EASY" },
  { text: "What is the chemical symbol for water?", options: ["H2O", "CO2", "NaCl", "O2"], correctAnswer: "H2O", category: "GENERAL", difficulty: "EASY" },
  { text: "What is the capital of France?", options: ["Paris", "London", "Berlin", "Rome"], correctAnswer: "Paris", category: "GENERAL", difficulty: "EASY" },
  { text: "How many days are in a leap year?", options: ["366", "365", "364", "367"], correctAnswer: "366", category: "GENERAL", difficulty: "EASY" },
  { text: "What is the largest ocean on Earth?", options: ["Pacific", "Atlantic", "Indian", "Arctic"], correctAnswer: "Pacific", category: "GENERAL", difficulty: "EASY" },

  // ── GENERAL MEDIUM ──
  { text: "What is the speed of light?", options: ["299,792 km/s", "150,000 km/s", "500,000 km/s", "100,000 km/s"], correctAnswer: "299,792 km/s", category: "GENERAL", difficulty: "MEDIUM" },
  { text: "What is the most spoken language in the world?", options: ["Mandarin Chinese", "English", "Spanish", "Hindi"], correctAnswer: "Mandarin Chinese", category: "GENERAL", difficulty: "MEDIUM" },
  { text: "What year did World War II end?", options: ["1945", "1944", "1946", "1943"], correctAnswer: "1945", category: "GENERAL", difficulty: "MEDIUM" },
  { text: "What is the human body's largest organ?", options: ["Skin", "Liver", "Brain", "Heart"], correctAnswer: "Skin", category: "GENERAL", difficulty: "MEDIUM" },
  { text: "What is photosynthesis?", options: ["Process plants use to convert sunlight to food", "Animal digestion process", "Chemical reaction in water", "How stars produce energy"], correctAnswer: "Process plants use to convert sunlight to food", category: "GENERAL", difficulty: "MEDIUM" },
  { text: "What is the capital of Japan?", options: ["Tokyo", "Osaka", "Kyoto", "Hiroshima"], correctAnswer: "Tokyo", category: "GENERAL", difficulty: "MEDIUM" },
  { text: "How many bones are in the adult human body?", options: ["206", "208", "198", "215"], correctAnswer: "206", category: "GENERAL", difficulty: "MEDIUM" },

  // ── GENERAL HARD ──
  { text: "What is the Higgs boson particle?", options: ["A particle that gives other particles mass", "The smallest known particle", "An antimatter particle", "A particle that carries light"], correctAnswer: "A particle that gives other particles mass", category: "GENERAL", difficulty: "HARD" },
  { text: "What is the theory of relativity?", options: ["Einstein's theory linking space, time, and gravity", "A theory about atomic structure", "A quantum mechanics theory", "A theory about evolution"], correctAnswer: "Einstein's theory linking space, time, and gravity", category: "GENERAL", difficulty: "HARD" },

  // ── SOCIAL EASY ──
  { text: "What is social media?", options: ["Online platforms for sharing content and connecting people", "A type of newspaper", "A TV channel", "A messaging app only"], correctAnswer: "Online platforms for sharing content and connecting people", category: "SOCIAL", difficulty: "EASY" },
  { text: "What does 'viral' mean on the internet?", options: ["Content spreading rapidly and widely", "A computer virus", "Spam messages", "Private content"], correctAnswer: "Content spreading rapidly and widely", category: "SOCIAL", difficulty: "EASY" },
  { text: "What is a hashtag used for?", options: ["Categorizing and finding content on social media", "Sending private messages", "Making phone calls", "Storing files"], correctAnswer: "Categorizing and finding content on social media", category: "SOCIAL", difficulty: "EASY" },

  // ── SOCIAL MEDIUM ──
  { text: "What is the gig economy?", options: ["A labor market of short-term contracts and freelance work", "A music industry term", "A stock market sector", "A type of government employment"], correctAnswer: "A labor market of short-term contracts and freelance work", category: "SOCIAL", difficulty: "MEDIUM" },
  { text: "What is 'cancel culture'?", options: ["Withdrawing support from public figures for offensive behavior", "Canceling subscriptions", "Blocking users online", "Deleting social media accounts"], correctAnswer: "Withdrawing support from public figures for offensive behavior", category: "SOCIAL", difficulty: "MEDIUM" },
  { text: "What is the digital divide?", options: ["Gap between those with and without access to technology", "Difference between digital and analog signals", "Competition between tech companies", "Screen time inequality"], correctAnswer: "Gap between those with and without access to technology", category: "SOCIAL", difficulty: "MEDIUM" },
  { text: "What is influencer marketing?", options: ["Using social media personalities to promote products", "Traditional TV advertising", "Email marketing campaigns", "Search engine optimization"], correctAnswer: "Using social media personalities to promote products", category: "SOCIAL", difficulty: "MEDIUM" },

  // ── SOCIAL HARD ──
  { text: "What is the 'filter bubble' effect?", options: ["Algorithms showing only content that matches existing views", "Blocking offensive content", "Parental controls on social media", "Content moderation policies"], correctAnswer: "Algorithms showing only content that matches existing views", category: "SOCIAL", difficulty: "HARD" },
  { text: "What is 'social capital' in sociology?", options: ["Networks and relationships that provide value to individuals", "Money donated to social causes", "Government social spending", "Corporate social responsibility"], correctAnswer: "Networks and relationships that provide value to individuals", category: "SOCIAL", difficulty: "HARD" },
];

async function seedQuestions() {
  console.log("🌱 Seeding questions...");

  // Delete existing standalone questions
  await prisma.question.deleteMany({ where: { contentId: null } });

  const saved = await prisma.question.createMany({
    data: questions.map((q) => ({
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: q.category as never,
      difficulty: q.difficulty as never,
      qualityScore: 8,
    })),
  });

  console.log(`✅ Seeded ${saved.count} questions`);
  console.log("📊 Breakdown:");

  const categories = ["FINANCE", "TECH", "SPORTS", "POLITICS", "GENERAL", "SOCIAL"];
  for (const cat of categories) {
    const count = questions.filter((q) => q.category === cat).length;
    console.log(`   ${cat}: ${count}`);
  }

  await prisma.$disconnect();
}

seedQuestions().catch(console.error);